import { SignalingClient, type SignalingMessage } from "./signaling";
import { deflate, inflate } from "pako";

export type InputMessage = {
  type: "input";
  button: number;
  down: boolean;
  seq: number;
};

export type ChatMessage = {
  id: string;
  text: string;
  sentAt: number;
};

export type PeerEventHandler = {
  onConnected: () => void;
  onDisconnected: () => void;
  onInput: (msg: InputMessage) => void;
  onError: (msg: string) => void;
  onGuestJoined?: (info: { guestNickname?: string; guestAvatar?: string }) => void;
  onRoomCreated?: (code: string) => void;
  onRoomJoined?: (info: {
    code: string;
    romFilename: string;
    core: string;
    bios?: string;
    hostNickname?: string;
    hostAvatar?: string;
  }) => void;
  onDataChannelState?: (state: string) => void;
  onPeerReady?: () => void;
  onSaveState?: (state: ArrayBuffer) => void;
  onStateLoaded?: () => void;
  onStartSignal?: () => void; // GUEST receives "go" from HOST
  // Fire-and-forget resync
  onResyncState?: (state: ArrayBuffer) => void; // GUEST: load this state
  onResyncLoaded?: () => void; // HOST: guest applied correction
  onResyncFailed?: () => void; // Resync failed
  // Input sequence gap detection
  onInputSeqGap?: (expected: number, got: number) => void;
  onChatChannelState?: (state: string) => void;
  onChatMessage?: (msg: ChatMessage) => void;
  onChatTyping?: (isTyping: boolean) => void;
};

type GameplayTransportState = "closed" | "connecting" | "open" | "closing";

type PendingBinaryStream = {
  totalBytes: number;
  chunks: number;
  received: ArrayBuffer[];
  bytesReceived: number;
};

type PendingResyncStream = PendingBinaryStream & {
  compressed: boolean;
};

const INPUT_CHANNEL_LABEL = "input";
const STATE_CHANNEL_LABEL = "state";
const CHAT_CHANNEL_LABEL = "chat";
const SAVE_STATE_CHUNK_SIZE = 64 * 1024;
const RESYNC_STATE_CHUNK_SIZE = 256 * 1024;
const CHAT_BUFFER_THRESHOLD = 64 * 1024;
const STATE_BUFFER_THRESHOLD = 512 * 1024;

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }, { urls: "stun:stun1.l.google.com:19302" }],
};

export class NetplayPeer {
  private signaling: SignalingClient;
  private pc: RTCPeerConnection | null = null;
  private inputDc: RTCDataChannel | null = null;
  private stateDc: RTCDataChannel | null = null;
  private chatDc: RTCDataChannel | null = null;
  private handler: PeerEventHandler;
  private _closing = false;
  private _chatSeq = 0;
  private _lastTypingState: boolean | null = null;
  private _gameplayTransportState: GameplayTransportState = "closed";
  private _gameplayConnected = false;

  constructor(handler: PeerEventHandler) {
    this.handler = handler;
    this.signaling = new SignalingClient(this.onSignaling);
  }

  async connect(serverUrl: string) {
    await this.signaling.connect(serverUrl);
  }

  createRoom(
    romFilename: string,
    core: string,
    bios?: string,
    nickname?: string,
    avatar?: string,
    isPublic?: boolean,
  ) {
    this.signaling.send({
      type: "create-room",
      romFilename,
      core,
      bios,
      nickname,
      avatar,
      isPublic,
    });
  }

  joinRoom(code: string, nickname?: string, avatar?: string) {
    this.signaling.send({ type: "join-room", code, nickname, avatar });
  }

  private _inputSeq = 0;

  sendInput(button: number, down: boolean) {
    if (this.inputDc?.readyState === "open") {
      this.inputDc.send(JSON.stringify({ type: "input", button, down, seq: ++this._inputSeq }));
    }
  }

  sendPeerReady() {
    console.log("[PEER] sendPeerReady, input dc:", this.inputDc?.readyState);
    if (this.inputDc?.readyState === "open") {
      this.inputDc.send(JSON.stringify({ type: "peer-ready" }));
    }
  }

  // Send save state as chunked binary over DataChannel
  sendSaveState(state: ArrayBuffer): boolean {
    if (this.stateDc?.readyState !== "open") {
      console.warn("[PEER] sendSaveState: state DC not open");
      return false;
    }
    if (this.stateDc.bufferedAmount > STATE_BUFFER_THRESHOLD) {
      console.warn(`[PEER] sendSaveState: backpressure, buffered=${this.stateDc.bufferedAmount}`);
      return false;
    }
    const total = state.byteLength;
    const numChunks = Math.ceil(total / SAVE_STATE_CHUNK_SIZE);
    console.log(`[PEER] sendSaveState: ${total} bytes, ${numChunks} chunks`);
    this.stateDc.send(
      JSON.stringify({ type: "save-state-header", totalBytes: total, chunks: numChunks }),
    );
    for (let i = 0; i < numChunks; i++) {
      const start = i * SAVE_STATE_CHUNK_SIZE;
      const end = Math.min(start + SAVE_STATE_CHUNK_SIZE, total);
      this.stateDc.send(state.slice(start, end));
    }
    console.log("[PEER] sendSaveState: all chunks sent");
    return true;
  }

  // Tell HOST that GUEST loaded the state
  sendStateLoaded() {
    console.log("[PEER] sendStateLoaded");
    if (this.inputDc?.readyState === "open") {
      this.inputDc.send(JSON.stringify({ type: "state-loaded" }));
    }
  }

  // HOST tells GUEST to start the game
  sendStartSignal() {
    console.log("[PEER] sendStartSignal");
    if (this.inputDc?.readyState === "open") {
      this.inputDc.send(JSON.stringify({ type: "start-signal" }));
    }
  }

  sendResyncFailed() {
    if (this.inputDc?.readyState === "open") {
      this.inputDc.send(JSON.stringify({ type: "resync-failed" }));
    }
  }

  sendResyncLoaded() {
    if (this.inputDc?.readyState === "open") {
      this.inputDc.send(JSON.stringify({ type: "resync-loaded" }));
    }
  }

  sendChatMessage(text: string): ChatMessage | null {
    if (this.chatDc?.readyState !== "open") return null;
    const trimmed = text.trim().slice(0, 300);
    if (!trimmed) return null;
    if (this.chatDc.bufferedAmount > CHAT_BUFFER_THRESHOLD) {
      console.warn(`[PEER] sendChatMessage: backpressure, buffered=${this.chatDc.bufferedAmount}`);
      return null;
    }
    const message = {
      id: `chat-${Date.now()}-${++this._chatSeq}`,
      text: trimmed,
      sentAt: Date.now(),
    };
    this.chatDc.send(JSON.stringify({ type: "chat-message", ...message }));
    return message;
  }

  sendTypingState(isTyping: boolean) {
    if (this.chatDc?.readyState !== "open") return;
    if (this._lastTypingState === isTyping) return;
    this._lastTypingState = isTyping;
    this.chatDc.send(JSON.stringify({ type: "chat-typing", isTyping }));
  }

  // --- Fire-and-forget resync ---
  /** Reset remote input sequence counter (after resync, GUEST resets) */
  resetRemoteSeq() {
    // Will be set when setupDataChannel runs; this method signals
    // the DC handler to accept next seq as the new baseline
    this._resetSeqFlag = true;
  }
  private _resetSeqFlag = false;

  sendResyncState(state: ArrayBuffer): boolean {
    if (this.stateDc?.readyState !== "open") return false;
    if (this.stateDc.bufferedAmount > STATE_BUFFER_THRESHOLD) {
      console.warn(`[PEER] sendResyncState: backpressure, buffered=${this.stateDc.bufferedAmount}`);
      return false;
    }
    const compressed = deflate(new Uint8Array(state));
    const total = compressed.byteLength;
    const numChunks = Math.ceil(total / RESYNC_STATE_CHUNK_SIZE);
    console.log(
      `[PEER] sendResyncState: raw=${state.byteLength}, compressed=${total} (${((1 - total / state.byteLength) * 100).toFixed(0)}% reduction)`,
    );
    this.stateDc.send(
      JSON.stringify({
        type: "resync-state-header",
        totalBytes: total,
        chunks: numChunks,
        compressed: true,
      }),
    );
    for (let i = 0; i < numChunks; i++) {
      const start = i * RESYNC_STATE_CHUNK_SIZE;
      const end = Math.min(start + RESYNC_STATE_CHUNK_SIZE, total);
      this.stateDc.send(compressed.slice(start, end).buffer);
    }
    return true;
  }

  close() {
    this._closing = true;
    this.inputDc?.close();
    this.stateDc?.close();
    this.chatDc?.close();
    this.pc?.close();
    this.signaling.close();
    this.inputDc = null;
    this.stateDc = null;
    this.chatDc = null;
    this.pc = null;
    this._gameplayConnected = false;
    this._gameplayTransportState = "closed";
  }

  // --- Private ---

  private onSignaling = (msg: SignalingMessage) => {
    switch (msg.type) {
      case "room-created":
        this.handler.onRoomCreated?.(msg.code);
        break;

      case "room-joined":
        this.handler.onRoomJoined?.(msg);
        break;

      case "guest-joined":
        this.handler.onGuestJoined?.(msg as { guestNickname?: string; guestAvatar?: string });
        this.startAsHost();
        break;

      case "offer":
        this.handleOffer(msg.sdp);
        break;

      case "answer":
        this.pc?.setRemoteDescription(msg.sdp);
        break;

      case "ice-candidate":
        this.pc?.addIceCandidate(msg.candidate);
        break;

      case "peer-disconnected":
        if (!this._closing) this.handler.onDisconnected();
        break;

      case "error":
        this.handler.onError(msg.message);
        break;
    }
  };

  private setupPeerConnection() {
    this.pc = new RTCPeerConnection(RTC_CONFIG);

    this.pc.onicecandidate = (e) => {
      if (e.candidate) {
        this.signaling.send({ type: "ice-candidate", candidate: e.candidate.toJSON() });
      }
    };

    this.pc.onconnectionstatechange = () => {
      if (this.pc?.connectionState === "disconnected" || this.pc?.connectionState === "failed") {
        if (!this._closing && this._gameplayConnected) {
          this._gameplayConnected = false;
          this.handler.onDisconnected();
        }
      }
    };
  }

  private emitGameplayTransportState() {
    const inputState = this.inputDc?.readyState ?? "closed";
    const stateState = this.stateDc?.readyState ?? "closed";

    let nextState: GameplayTransportState = "closed";
    if (inputState === "open" && stateState === "open") {
      nextState = "open";
    } else if (inputState === "closing" || stateState === "closing") {
      nextState = "closing";
    } else if (
      inputState === "connecting" ||
      stateState === "connecting" ||
      inputState === "open" ||
      stateState === "open"
    ) {
      nextState = "connecting";
    }

    if (nextState !== this._gameplayTransportState) {
      this._gameplayTransportState = nextState;
      this.handler.onDataChannelState?.(nextState);
    }

    if (!this._gameplayConnected && nextState === "open") {
      this._gameplayConnected = true;
      this.handler.onConnected();
      return;
    }

    if (this._gameplayConnected && nextState !== "open" && !this._closing) {
      this._gameplayConnected = false;
      this.handler.onDisconnected();
      return;
    }

    this._gameplayConnected = nextState === "open";
  }

  private setupInputDataChannel(dc: RTCDataChannel) {
    this.inputDc = dc;
    this.emitGameplayTransportState();

    let expectedSeq = 1;

    dc.onopen = () => {
      this.emitGameplayTransportState();
    };

    dc.onclose = () => {
      this.emitGameplayTransportState();
    };

    dc.onmessage = (e) => {
      if (typeof e.data !== "string") {
        return;
      }

      try {
        const msg = JSON.parse(e.data);
        if (msg.type === "input") {
          const inp = msg as InputMessage;
          if (this._resetSeqFlag) {
            expectedSeq = inp.seq;
            this._resetSeqFlag = false;
          }
          if (inp.seq !== expectedSeq) {
            console.warn(`[PEER] input seq gap: expected ${expectedSeq}, got ${inp.seq}`);
            this.handler.onInputSeqGap?.(expectedSeq, inp.seq);
          }
          expectedSeq = inp.seq + 1;
          this.handler.onInput(inp);
        } else if (msg.type === "peer-ready") {
          console.log("[PEER] received peer-ready");
          this.handler.onPeerReady?.();
        } else if (msg.type === "state-loaded") {
          console.log("[PEER] received state-loaded");
          this.handler.onStateLoaded?.();
        } else if (msg.type === "start-signal") {
          console.log("[PEER] received start-signal");
          this.handler.onStartSignal?.();
        } else if (msg.type === "resync-loaded") {
          this.handler.onResyncLoaded?.();
        } else if (msg.type === "resync-failed") {
          this.handler.onResyncFailed?.();
        }
      } catch {
        /* ignore */
      }
    };
  }

  private setupStateDataChannel(dc: RTCDataChannel) {
    this.stateDc = dc;
    dc.binaryType = "arraybuffer";
    this.emitGameplayTransportState();

    let pendingState: PendingBinaryStream | null = null;
    let pendingResync: PendingResyncStream | null = null;

    dc.onopen = () => {
      this.emitGameplayTransportState();
    };

    dc.onclose = () => {
      this.emitGameplayTransportState();
    };

    dc.onmessage = (e) => {
      if (e.data instanceof ArrayBuffer) {
        if (pendingResync) {
          pendingResync.received.push(e.data);
          pendingResync.bytesReceived += e.data.byteLength;
          if (pendingResync.received.length >= pendingResync.chunks) {
            const full = new Uint8Array(pendingResync.totalBytes);
            let offset = 0;
            for (const chunk of pendingResync.received) {
              full.set(new Uint8Array(chunk), offset);
              offset += chunk.byteLength;
            }
            const wasCompressed = pendingResync.compressed;
            pendingResync = null;
            if (wasCompressed) {
              const decompressed = inflate(full);
              this.handler.onResyncState?.(decompressed.buffer);
            } else {
              this.handler.onResyncState?.(full.buffer);
            }
          }
          return;
        }

        if (!pendingState) return;

        pendingState.received.push(e.data);
        pendingState.bytesReceived += e.data.byteLength;
        if (pendingState.received.length >= pendingState.chunks) {
          const full = new Uint8Array(pendingState.totalBytes);
          let offset = 0;
          for (const chunk of pendingState.received) {
            full.set(new Uint8Array(chunk), offset);
            offset += chunk.byteLength;
          }
          pendingState = null;
          this.handler.onSaveState?.(full.buffer);
        }
        return;
      }

      if (typeof e.data !== "string") return;

      try {
        const msg = JSON.parse(e.data);
        if (msg.type === "save-state-header") {
          console.log(
            `[PEER] received save-state-header: ${msg.totalBytes} bytes, ${msg.chunks} chunks`,
          );
          pendingState = {
            totalBytes: msg.totalBytes,
            chunks: msg.chunks,
            received: [],
            bytesReceived: 0,
          };
        } else if (msg.type === "resync-state-header") {
          pendingResync = {
            totalBytes: msg.totalBytes,
            chunks: msg.chunks,
            received: [],
            bytesReceived: 0,
            compressed: !!msg.compressed,
          };
        }
      } catch {
        /* ignore */
      }
    };
  }

  private setupChatDataChannel(dc: RTCDataChannel) {
    this.chatDc = dc;
    this._lastTypingState = null;
    this.handler.onChatChannelState?.(dc.readyState);

    dc.onopen = () => {
      this._lastTypingState = false;
      this.handler.onChatChannelState?.("open");
    };

    dc.onclose = () => {
      this._lastTypingState = null;
      this.handler.onChatChannelState?.("closed");
    };

    dc.onmessage = (e) => {
      if (typeof e.data !== "string") return;

      try {
        const msg = JSON.parse(e.data);

        if (msg.type === "chat-message") {
          const text = typeof msg.text === "string" ? msg.text.trim().slice(0, 300) : "";
          if (!text) return;

          this.handler.onChatMessage?.({
            id: typeof msg.id === "string" ? msg.id : `chat-${Date.now()}`,
            text,
            sentAt: typeof msg.sentAt === "number" ? msg.sentAt : Date.now(),
          });
        } else if (msg.type === "chat-typing") {
          this.handler.onChatTyping?.(!!msg.isTyping);
        }
      } catch {
        /* ignore */
      }
    };
  }

  private async startAsHost() {
    this.setupPeerConnection();
    const inputDc = this.pc!.createDataChannel(INPUT_CHANNEL_LABEL);
    const stateDc = this.pc!.createDataChannel(STATE_CHANNEL_LABEL);
    const chatDc = this.pc!.createDataChannel(CHAT_CHANNEL_LABEL);
    this.setupInputDataChannel(inputDc);
    this.setupStateDataChannel(stateDc);
    this.setupChatDataChannel(chatDc);

    const offer = await this.pc!.createOffer();
    await this.pc!.setLocalDescription(offer);
    this.signaling.send({ type: "offer", sdp: this.pc!.localDescription! });
  }

  private async handleOffer(sdp: RTCSessionDescriptionInit) {
    this.setupPeerConnection();

    this.pc!.ondatachannel = (e) => {
      if (e.channel.label === CHAT_CHANNEL_LABEL) {
        this.setupChatDataChannel(e.channel);
        return;
      }

      if (e.channel.label === INPUT_CHANNEL_LABEL) {
        this.setupInputDataChannel(e.channel);
        return;
      }

      if (e.channel.label === STATE_CHANNEL_LABEL) {
        this.setupStateDataChannel(e.channel);
      }
    };

    await this.pc!.setRemoteDescription(sdp);
    const answer = await this.pc!.createAnswer();
    await this.pc!.setLocalDescription(answer);
    this.signaling.send({ type: "answer", sdp: this.pc!.localDescription! });
  }
}
