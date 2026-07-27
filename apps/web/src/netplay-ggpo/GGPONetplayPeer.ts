/**
 * GGPONetplayPeer — GGPO용 WebRTC P2P 연결 관리
 *
 * 기존 NetplayPeer를 참고하여 GGPO 방식에 필요한 채널만 사용하는 경량 버전.
 *
 * DataChannel:
 * - "input"  (Unordered/Unreliable) → GGPO 입력 메시지
 * - "control" (Ordered/Reliable)     → 피어 준비, 시작, 하트비트
 * - "chat"   (Ordered/Reliable)      → 채팅 메시지
 *
 * 비디오 스트리밍과 repair 채널은 GGPO 방식에서는 불필요하므로 제거.
 *
 * 연결 완료 감지는 RTCPeerConnection "connected"가 아닌
 * DataChannel "open" 이벤트 기반으로 한다.
 */

import type { GGPOInputMessage, GGPOControlMessage } from "./types";

// ---------- 타입 정의 ----------

export type ChatMessage = {
  id: string;
  text: string;
  sentAt: number;
  authorName?: string;
  authorAvatar?: string;
  authorRole?: "host" | "guest" | "spectator";
};

export type GGPOPeerEventHandlers = {
  onConnected?: () => void;
  onDisconnected?: () => void;
  onInput?: (msg: GGPOInputMessage) => void;
  onControl?: (msg: GGPOControlMessage) => void;
  onError?: (msg: string) => void;
  onRoomCreated?: (code: string) => void;
  onRoomJoined?: (info: {
    code: string;
    role: "guest" | "spectator";
    romFilename: string;
    core: string;
  }) => void;
  onGuestJoined?: (info: { guestNickname?: string }) => void;
  onLobbyUpdated?: (info: {
    code: string;
    roomState: string;
    canStart: boolean;
    hasGuest: boolean;
    participants: unknown[];
  }) => void;
  onBinaryState?: (data: ArrayBuffer) => void;
  onVideoStream?: (stream: MediaStream) => void;
  onChatMessage?: (msg: ChatMessage) => void;
  onChatTyping?: (isTyping: boolean) => void;
  onRoomKicked?: (message: string) => void;
};

// ---------- 상수 ----------

const INPUT_CHANNEL = "input";
const CONTROL_CHANNEL = "control";
const CHAT_CHANNEL = "chat";

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ],
};

// ---------- 시그널링 메시지 타입 ----------

type SignalingMsg =
  | { type: "create-room"; romFilename: string; core: string; nickname?: string }
  | { type: "join-room"; code: string; nickname?: string }
  | { type: "spectate-room"; code: string; nickname?: string }
  | { type: "offer"; sdp: RTCSessionDescriptionInit }
  | { type: "answer"; sdp: RTCSessionDescriptionInit }
  | { type: "ice-candidate"; candidate: RTCIceCandidateInit }
  | { type: "session-started" }
  | { type: "set-room-ready"; ready: boolean }
  | { type: "kick-room-participant"; participantId: string };

type SignalingResponse =
  | { type: "room-created"; code: string }
  | { type: "room-joined"; code: string; role: "guest" | "spectator"; romFilename: string; core: string }
  | { type: "guest-joined"; guestNickname?: string }
  | { type: "room-session-started"; code: string }
  | { type: "peer-disconnected" }
  | { type: "room-kicked"; message: string }
  | { type: "error"; message: string }
  | { type: "room-lobby-updated"; code: string; roomState: string; canStart: boolean; hasGuest: boolean; participants: unknown[] }
  | { type: "offer"; sdp: RTCSessionDescriptionInit }
  | { type: "answer"; sdp: RTCSessionDescriptionInit }
  | { type: "ice-candidate"; candidate: RTCIceCandidateInit };

// ---------- SignalingClient (간단한 WebSocket 래퍼) ----------

class SignalingClient {
  private ws: WebSocket | null = null;
  private onMessage: (msg: SignalingResponse) => void;
  private _closing = false;

  constructor(onMessage: (msg: SignalingResponse) => void) {
    this.onMessage = onMessage;
  }

  async connect(url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(url);
        this.ws.onopen = () => resolve();
        this.ws.onerror = () => reject(new Error("WebSocket connection failed"));
        this.ws.onclose = () => {
          if (!this._closing) {
            this.onMessage({ type: "peer-disconnected" });
          }
        };
        this.ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data as string) as SignalingResponse;
            this.onMessage(msg);
          } catch {
            // ignore invalid messages
          }
        };
      } catch (err) {
        reject(err);
      }
    });
  }

  send(msg: SignalingMsg): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  close(): void {
    this._closing = true;
    this.ws?.close();
    this.ws = null;
  }
}

// ---------- GGPONetplayPeer ----------

export class GGPONetplayPeer {
  private signaling: SignalingClient;
  private pc: RTCPeerConnection | null = null;
  private inputDc: RTCDataChannel | null = null;
  private controlDc: RTCDataChannel | null = null;
  private chatDc: RTCDataChannel | null = null;
  private handlers: GGPOPeerEventHandlers;
  private _closing = false;
  private _connectionMode: "host" | "guest" | "spectator" | null = null;
  private _localNickname = "";
  private _chatSeq = 0;
  private _lastTypingState: boolean | null = null;
  private _dcOpenCount = 0;
  private _dcExpected = 0;
  private _channelsOpen = false;
  private _videoSenders: RTCRtpSender[] = [];
  private _negotiating = false;

  constructor(handlers: GGPOPeerEventHandlers) {
    this.handlers = handlers;
    this.signaling = new SignalingClient(this.onSignalingMessage);
  }

  // ───── Public API ─────

  async connect(serverUrl: string): Promise<void> {
    await this.signaling.connect(serverUrl);
  }

  createRoom(romFilename: string, core: string, nickname?: string): void {
    this._connectionMode = "host";
    this._localNickname = nickname ?? "";
    this.signaling.send({ type: "create-room", romFilename, core, nickname });
  }

  joinRoom(code: string, nickname?: string): void {
    this._connectionMode = "guest";
    this._localNickname = nickname ?? "";
    this.signaling.send({ type: "join-room", code, nickname });
  }

  spectateRoom(code: string, nickname?: string): void {
    this._connectionMode = "spectator";
    this._localNickname = nickname ?? "";
    this.signaling.send({ type: "spectate-room", code, nickname });
  }

  /** 게임이 시작되었음을 서버에 알림 */
  markSessionStarted(): void {
    if (this._connectionMode === "host") {
      this.signaling.send({ type: "session-started" });
    }
  }

  /** GUEST/관전자가 준비 완료 상태를 서버에 알림 */
  setRoomReady(ready: boolean): void {
    if (this._connectionMode === "guest" || this._connectionMode === "spectator") {
      this.signaling.send({ type: "set-room-ready", ready });
    }
  }

  /** Video+Audio 스트리밍 시작 (HOST) */
  startVideoStreaming(stream: MediaStream): void {
    void stream; // consumed via addTrack below
    if (!this.pc) {
      console.warn("[FBNeo Peer] startVideoStreaming: no peer connection");
      return;
    }
    for (const track of stream.getTracks()) {
      const sender = this.pc.addTrack(track, stream);
      this._videoSenders.push(sender);
    }
    console.log(`[FBNeo Peer] streaming ${stream.getVideoTracks().length}v + ${stream.getAudioTracks().length}a tracks`);
  }

  /** 바이너리 상태 전송 (초기 동기화용) */
  sendBinaryState(data: Uint8Array): void {
    if (this.controlDc?.readyState !== "open") return;
    try {
      // @ts-expect-error: GGPO remnant — SharedArrayBuffer type mismatch, to be deleted
      this.controlDc.send(data);
    } catch {
      console.warn("[GGPO Peer] failed to send binary state");
    }
  }

  /** GGPO 입력 메시지 전송 (unreliable) */
  sendInput(frameNum: number, inputMask: number): void {
    if (this.inputDc?.readyState !== "open") return;

    const msg: GGPOInputMessage = {
      type: "input",
      frameNum,
      inputMask,
      seq: frameNum,
      sentAt: performance.now(),
    };

    try {
      this.inputDc.send(JSON.stringify(msg));
    } catch {
      // ignore send errors (unreliable channel)
    }
  }

  /** 제어 메시지 전송 (reliable) */
  sendControl(msg: GGPOControlMessage): void {
    if (this.controlDc?.readyState !== "open") return;
    try {
      this.controlDc.send(JSON.stringify(msg));
    } catch {
      console.warn("[GGPO Peer] failed to send control message");
    }
  }

  /** 하트비트 전송 */
  sendHeartbeat(): void {
    this.sendControl({ type: "heartbeat", ts: Date.now() });
  }

  /** 채팅 메시지 전송 */
  sendChatMessage(text: string): ChatMessage | null {
    const trimmed = text.trim().slice(0, 300);
    if (!trimmed) return null;

    const msg: ChatMessage = {
      id: `chat-${Date.now()}-${++this._chatSeq}`,
      text: trimmed,
      sentAt: Date.now(),
      authorName: this._localNickname,
      authorRole: this._connectionMode === "spectator" ? "spectator" : this._connectionMode === "guest" ? "guest" : "host",
    };

    if (this.chatDc?.readyState !== "open") return null;

    try {
      this.chatDc.send(JSON.stringify({ type: "chat-message", ...msg }));
      return msg;
    } catch {
      return null;
    }
  }

  /** 타이핑 상태 전송 */
  sendTypingState(isTyping: boolean): void {
    if (this.chatDc?.readyState !== "open") return;
    if (this._lastTypingState === isTyping) return;
    this._lastTypingState = isTyping;
    try {
      this.chatDc.send(JSON.stringify({ type: "chat-typing", isTyping }));
    } catch {
      // ignore
    }
  }

  /** 연결 종료 */
  close(): void {
    this._closing = true;
    this._videoSenders = [];
    this.inputDc?.close();
    this.controlDc?.close();
    this.chatDc?.close();
    this.pc?.close();
    this.signaling.close();
    this.inputDc = null;
    this.controlDc = null;
    this.chatDc = null;
    this.pc = null;
  }

  // ───── 시그널링 핸들러 ─────

  private onSignalingMessage = async (msg: SignalingResponse): Promise<void> => {
    switch (msg.type) {
      case "room-created":
        this.handlers.onRoomCreated?.(msg.code);
        break;

      case "room-joined":
        this.handlers.onRoomJoined?.(msg);
        break;

      case "guest-joined":
        this.handlers.onGuestJoined?.(msg);
        break;

      case "room-session-started":
        // HOST: 게임 시작 시 피어 연결 수립
        if (this._connectionMode === "host") {
          await this.createHostConnection();
        }
        break;

      case "offer":
        await this.handleOffer(msg.sdp);
        break;

      case "answer":
        await this.pc?.setRemoteDescription(new RTCSessionDescription(msg.sdp));
        break;

      case "ice-candidate":
        try {
          await this.pc?.addIceCandidate(new RTCIceCandidate(msg.candidate));
        } catch {
          // ignore invalid candidates
        }
        break;

      case "room-lobby-updated":
        this.handlers.onLobbyUpdated?.(msg as unknown as {
          code: string; roomState: string; canStart: boolean; hasGuest: boolean; participants: unknown[];
        });
        break;

      case "peer-disconnected":
        if (!this._closing) this.handlers.onDisconnected?.();
        break;

      case "room-kicked":
        this.handlers.onRoomKicked?.(msg.message);
        break;

      case "error":
        this.handlers.onError?.(msg.message);
        break;
    }
  };

  // ───── WebRTC 연결 ─────

  private async createHostConnection(): Promise<void> {
    this.pc = this.createPeerConnection();

    // DataChannel 생성 (HOST 측에서 먼저 만듦)
    this.inputDc = this.pc.createDataChannel(INPUT_CHANNEL, {
      ordered: false,
      maxRetransmits: 0,
    });
    this.controlDc = this.pc.createDataChannel(CONTROL_CHANNEL, {
      ordered: true,
    });
    this.chatDc = this.pc.createDataChannel(CHAT_CHANNEL, {
      ordered: true,
    });

    this.setupDataChannels();

    // Offer 생성
    const offer = await this.pc.createOffer();
    await this.pc.setLocalDescription(offer);
    this.signaling.send({ type: "offer", sdp: offer });
  }

  private async handleOffer(sdp: RTCSessionDescriptionInit): Promise<void> {
    if (this.pc) {
      // 재협상: 기존 PC에 remote description만 설정
      await this.pc.setRemoteDescription(new RTCSessionDescription(sdp));
      const answer = await this.pc.createAnswer();
      await this.pc.setLocalDescription(answer);
      this.signaling.send({ type: "answer", sdp: answer });
      return;
    }

    // 초기 연결
    this.pc = this.createPeerConnection();

    this.pc.ondatachannel = (event) => {
      const channel = event.channel;
      switch (channel.label) {
        case INPUT_CHANNEL:
          this.inputDc = channel;
          break;
        case CONTROL_CHANNEL:
          this.controlDc = channel;
          break;
        case CHAT_CHANNEL:
          this.chatDc = channel;
          break;
      }
      if (channel.label === CONTROL_CHANNEL || channel.label === INPUT_CHANNEL) {
        this.setupDataChannels();
      }
    };

    await this.pc.setRemoteDescription(new RTCSessionDescription(sdp));
    const answer = await this.pc.createAnswer();
    await this.pc.setLocalDescription(answer);
    this.signaling.send({ type: "answer", sdp: answer });
  }

  private createPeerConnection(): RTCPeerConnection {
    const pc = new RTCPeerConnection(RTC_CONFIG);

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.signaling.send({
          type: "ice-candidate",
          candidate: event.candidate.toJSON(),
        });
      }
    };

    // 비디오 스트리밍 수신 (GUEST)
    pc.ontrack = (event) => {
      console.log("[FBNeo Peer] ontrack fired, streams:", event.streams.length);
      const stream = event.streams[0] ?? new MediaStream([event.track]);
      this.handlers.onVideoStream?.(stream);
    };

    // HOST가 startVideoStreaming으로 track 추가 시 재협상 필요
    pc.onnegotiationneeded = async () => {
      if (this._closing || this._negotiating) return;
      this._negotiating = true;
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        if (!pc.localDescription) return;
        this.signaling.send({ type: "offer", sdp: pc.localDescription });
      } catch (err) {
        console.warn("[GGPO Peer] negotiation failed:", err);
      } finally {
        this._negotiating = false;
      }
    };

    return pc;
  }

  private checkChannelsOpen(): void {
    if (this._channelsOpen) return;
    this._dcOpenCount++;
    if (this._dcOpenCount >= this._dcExpected && this._dcExpected >= 2) {
      this._channelsOpen = true;
      console.log("[GGPO Peer] All DataChannels open — connected!");
      this.handlers.onConnected?.();
    }
  }

  private setupDataChannels(): void {
    this._dcExpected = 0;
    this._dcOpenCount = 0;
    this._channelsOpen = false;

    // Input 채널
    if (this.inputDc) {
      this._dcExpected++;
      if (this.inputDc.readyState === "open") {
        this.checkChannelsOpen();
      }
      this.inputDc.onopen = () => this.checkChannelsOpen();
      this.inputDc.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data as string) as GGPOInputMessage;
          if (msg.type === "input") {
            this.handlers.onInput?.(msg);
          }
        } catch { /* ignore */ }
      };
    }

    // Control 채널
    if (this.controlDc) {
      this._dcExpected++;
      if (this.controlDc.readyState === "open") {
        this.checkChannelsOpen();
      }
      this.controlDc.onopen = () => this.checkChannelsOpen();
      this.controlDc.onmessage = (event) => {
        // 바이너리면 상태 데이터, 아니면 JSON 제어 메시지
        if (event.data instanceof ArrayBuffer || event.data instanceof Uint8Array) {
          const buf: ArrayBuffer = event.data instanceof ArrayBuffer ? event.data : (event.data.buffer as ArrayBuffer);
          this.handlers.onBinaryState?.(buf);
          return;
        }
        try {
          const msg = JSON.parse(event.data as string) as GGPOControlMessage;
          this.handlers.onControl?.(msg);
        } catch { /* ignore */ }
      };
    }

    // Chat 채널 (connected 판단에 사용하지 않음)
    if (this.chatDc) {
      this.chatDc.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data as string);
          if (msg.type === "chat-message") {
            this.handlers.onChatMessage?.(msg as ChatMessage);
          } else if (msg.type === "chat-typing") {
            this.handlers.onChatTyping?.(msg.isTyping as boolean);
          }
        } catch { /* ignore */ }
      };
    }
  }
}