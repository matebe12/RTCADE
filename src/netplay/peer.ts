import {
  SignalingClient,
  type RoomLobbySnapshotMessage,
  type RoomSessionStartedMessage,
  type SignalingMessage,
} from "./signaling";
import { deflate, inflate } from "pako";

export type InputMessage = {
  type: "input";
  button: number;
  down: boolean;
  heldMask: number;
  seq: number;
};

export type ResyncStatePayload = {
  stateBuffer: ArrayBuffer;
  remoteHeldMask: number;
  remoteInputSeq: number;
  stats: {
    compressedBytes: number;
    decompressMs: number;
    rawBytes: number;
    receiveMs: number;
  };
};

export type ChatMessage = {
  id: string;
  text: string;
  sentAt: number;
  authorAvatar?: string;
  authorName?: string;
  authorRole?: "host" | "guest" | "spectator";
};

export type InputSyncMessage = {
  type: "input-sync";
  heldMask: number;
  seq: number;
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
    participantId: string;
    role: "guest" | "spectator";
    romFilename: string;
    romPath: string;
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
  onResyncState?: (payload: ResyncStatePayload) => void; // GUEST: load this state
  onResyncLoaded?: () => void; // HOST: guest applied correction
  onResyncFailed?: () => void; // Resync failed
  // Input sequence gap detection
  onInputSeqGap?: (expected: number, got: number) => void;
  onRemoteHeldMask?: (heldMask: number) => void;
  onChatChannelState?: (state: string) => void;
  onChatMessage?: (msg: ChatMessage) => void;
  onChatTyping?: (isTyping: boolean) => void;
  onVideoStream?: (stream: MediaStream) => void;
  onHeartbeat?: (ts: number) => void;
  onRoomLobbyUpdated?: (info: Omit<RoomLobbySnapshotMessage, "type">) => void;
  onSessionStarted?: (info: Omit<RoomSessionStartedMessage, "type">) => void;
  onRoomKicked?: (message: string) => void;
};

type GameplayTransportState = "closed" | "connecting" | "open" | "closing";

type ConnectionMode = "host" | "guest" | "spectator" | null;

type Profile = {
  avatar?: string;
  nickname?: string;
};

type SpectatorPeerState = {
  chatDc: RTCDataChannel | null;
  controlDc: RTCDataChannel | null;
  id: string;
  nickname?: string;
  avatar?: string;
  pc: RTCPeerConnection;
  senders: RTCRtpSender[];
  negotiating: boolean;
  negotiationQueued: boolean;
};

type PendingSpectatorInfo = {
  spectatorId: string;
  spectatorNickname?: string;
  spectatorAvatar?: string;
};

type PendingBinaryStream = {
  totalBytes: number;
  chunks: number;
  buffer: Uint8Array;
  bytesReceived: number;
  chunksReceived: number;
  writeOffset: number;
};

type PendingResyncStream = PendingBinaryStream & {
  compressed: boolean;
  heldMask: number;
  inputSeq: number;
  rawBytes: number;
  startedAt: number;
};

const INPUT_CHANNEL_LABEL = "input";
const CONTROL_CHANNEL_LABEL = "control";
const STATE_CHANNEL_LABEL = "state";
const REPAIR_CHANNEL_LABEL = "repair";
const CHAT_CHANNEL_LABEL = "chat";
const SAVE_STATE_CHUNK_SIZE = 64 * 1024;
const RESYNC_STATE_CHUNK_SIZE = 256 * 1024;
const CHAT_BUFFER_THRESHOLD = 64 * 1024;
const STATE_BUFFER_THRESHOLD = 512 * 1024;
const DEFAULT_REMOTE_HELD_MASK = 0;
const REPAIR_SYNC_INTERVAL_MS = 120;
const REPAIR_SYNC_ZERO_FLUSH_COUNT = 3;
const VIDEO_STREAM_MAX_BITRATE = 4_000_000;
const VIDEO_STREAM_MAX_FRAMERATE = 45;
const VIDEO_STREAM_SCALE_DOWN = 2.0;
const VIDEO_STREAM_PLAYOUT_DELAY_SEC = 0.03;
const GAMEPLAY_DISCONNECT_GRACE_MS = 4_000;

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }, { urls: "stun:stun1.l.google.com:19302" }],
};

export class NetplayPeer {
  private signaling: SignalingClient;
  private pc: RTCPeerConnection | null = null;
  private inputDc: RTCDataChannel | null = null;
  private controlDc: RTCDataChannel | null = null;
  private stateDc: RTCDataChannel | null = null;
  private repairDc: RTCDataChannel | null = null;
  private chatDc: RTCDataChannel | null = null;
  private handler: PeerEventHandler;
  private _closing = false;
  private _chatSeq = 0;
  private _lastTypingState: boolean | null = null;
  private _gameplayTransportState: GameplayTransportState = "closed";
  private _gameplayConnected = false;
  private _localHeldMask = 0;
  private _resetSeqTo: number | null = null;
  private _resetRepairSeqTo: number | null = null;
  private _repairSyncTimer: ReturnType<typeof setInterval> | null = null;
  private _repairZeroFlushRemaining = 0;
  private _videoSenders: RTCRtpSender[] = [];
  private _negotiating = false;
  private _connectionMode: ConnectionMode = null;
  private _guestProfile: Profile | null = null;
  private _localProfile: Profile = {};
  private _spectatorPeers = new Map<string, SpectatorPeerState>();
  private _pendingSpectatorInfos = new Map<string, PendingSpectatorInfo>();
  private _spectatorVideoReady = false;
  private _sessionStarted = false;
  private _stream: MediaStream | null = null;
  private _rtcConfig: RTCConfiguration;
  private _disconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private _disconnectReason: string | null = null;

  constructor(handler: PeerEventHandler, rtcConfig: RTCConfiguration = RTC_CONFIG) {
    this.handler = handler;
    this._rtcConfig = rtcConfig;
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
    this._connectionMode = "host";
    this._guestProfile = null;
    this._sessionStarted = false;
    this._pendingSpectatorInfos.clear();
    this._localProfile = { nickname, avatar };
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
    this._connectionMode = "guest";
    this._sessionStarted = false;
    this._localProfile = { nickname, avatar };
    this.signaling.send({ type: "join-room", code, nickname, avatar });
  }

  spectateRoom(code: string, nickname?: string, avatar?: string) {
    this._connectionMode = "spectator";
    this._sessionStarted = false;
    this._localProfile = { nickname, avatar };
    this.signaling.send({ type: "spectate-room", code, nickname, avatar });
  }

  setRoomReady(ready: boolean) {
    if (this._connectionMode !== "guest" && this._connectionMode !== "spectator") {
      return;
    }

    this.signaling.send({ type: "set-room-ready", ready });
  }

  updateRoomGame(romPath: string, core: string, bios?: string) {
    if (this._connectionMode !== "host" || this._sessionStarted) {
      return;
    }

    this.signaling.send({ type: "update-room-game", romPath, core, bios });
  }

  kickRoomParticipant(participantId: string) {
    if (this._connectionMode !== "host" || !participantId || participantId === "host") {
      return;
    }

    this.signaling.send({ type: "kick-room-participant", participantId });
  }

  markSessionStarted() {
    if (this._connectionMode !== "host") {
      return;
    }

    this.signaling.send({ type: "session-started" });
  }

  private _inputSeq = 0;

  sendInput(button: number, down: boolean) {
    if (this.inputDc?.readyState === "open") {
      this._localHeldMask = updateHeldMask(this._localHeldMask, button, down);
      this.inputDc.send(
        JSON.stringify({
          type: "input",
          button,
          down,
          heldMask: this._localHeldMask,
          seq: ++this._inputSeq,
        }),
      );
      this.sendRepairSync();
      this.updateRepairSyncLoop();
    }
  }

  sendPeerReady() {
    console.log("[PEER] sendPeerReady, control dc:", this.controlDc?.readyState);
    if (this.controlDc?.readyState === "open") {
      this.controlDc.send(JSON.stringify({ type: "peer-ready" }));
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
    if (this.controlDc?.readyState === "open") {
      this.controlDc.send(JSON.stringify({ type: "state-loaded" }));
    }
  }

  // HOST tells GUEST to start the game
  sendStartSignal() {
    console.log("[PEER] sendStartSignal");
    if (this.controlDc?.readyState === "open") {
      this.controlDc.send(JSON.stringify({ type: "start-signal" }));
    }
  }

  sendResyncFailed() {
    if (this.controlDc?.readyState === "open") {
      this.controlDc.send(JSON.stringify({ type: "resync-failed" }));
    }
  }

  sendResyncLoaded() {
    if (this.controlDc?.readyState === "open") {
      this.controlDc.send(JSON.stringify({ type: "resync-loaded" }));
    }
  }

  /** Send a heartbeat message (HOST → GUEST, periodic keepalive) */
  sendHeartbeat() {
    if (this.controlDc?.readyState === "open") {
      this.controlDc.send(JSON.stringify({ type: "heartbeat", ts: Date.now() }));
    }

    for (const spectator of this._spectatorPeers.values()) {
      if (spectator.controlDc?.readyState === "open") {
        spectator.controlDc.send(JSON.stringify({ type: "heartbeat", ts: Date.now() }));
      }
    }
  }

  sendChatMessage(text: string): ChatMessage | null {
    const trimmed = text.trim().slice(0, 300);
    if (!trimmed) return null;

    const message: ChatMessage = {
      id: `chat-${Date.now()}-${++this._chatSeq}`,
      text: trimmed,
      sentAt: Date.now(),
      authorName: this._localProfile.nickname,
      authorAvatar: this._localProfile.avatar,
      authorRole:
        this._connectionMode === "spectator"
          ? "spectator"
          : this._connectionMode === "guest"
            ? "guest"
            : "host",
    };

    if (this.chatDc?.readyState !== "open") return null;
    if (this.chatDc.bufferedAmount > CHAT_BUFFER_THRESHOLD) {
      console.warn(`[PEER] sendChatMessage: backpressure, buffered=${this.chatDc.bufferedAmount}`);
      return null;
    }

    this.chatDc.send(JSON.stringify({ type: "chat-message", ...message }));

    if (this._connectionMode === "host") {
      this.broadcastChatToSpectators(message);
    }

    return message;
  }

  sendTypingState(isTyping: boolean) {
    if (this.chatDc?.readyState !== "open") return;
    if (this._lastTypingState === isTyping) return;
    this._lastTypingState = isTyping;
    this.chatDc.send(JSON.stringify({ type: "chat-typing", isTyping }));
  }

  /** Add video+audio tracks from a MediaStream to the peer connection and trigger renegotiation */
  startVideoStreaming(stream: MediaStream) {
    this._stream = stream;

    if (!this.pc) {
      if (this._connectionMode === "host" && this._sessionStarted) {
        console.log("[PEER] startVideoStreaming: stream ready before main peer offer; starting host connection");
        void this.startAsHost();
      } else {
        console.warn("[PEER] startVideoStreaming: no peer connection");
      }
    } else {
      this.replaceStreamTracks(this.pc, this._videoSenders, stream);
    }

    if (this._connectionMode === "host" && this._sessionStarted) {
      for (const spectator of this._pendingSpectatorInfos.values()) {
        this.createSpectatorConnection(spectator);
      }
    }

    for (const spectator of this._spectatorPeers.values()) {
      this.replaceStreamTracks(spectator.pc, spectator.senders, stream);
      void this.requestSpectatorNegotiation(spectator);
    }

    console.log(
      `[PEER] startVideoStreaming: added ${stream.getVideoTracks().length} video + ${stream.getAudioTracks().length} audio track(s)`,
    );
  }

  /** Stop sending video tracks */
  stopVideoStreaming() {
    this._stream = null;
    this.removeStreamTracks(this.pc, this._videoSenders);

    for (const spectator of this._spectatorPeers.values()) {
      this.removeStreamTracks(spectator.pc, spectator.senders);
    }
  }

  // --- Fire-and-forget resync ---
  /** Reset remote input sequence counter (after resync, GUEST resets) */
  resetRemoteSeq(nextExpectedSeq: number) {
    this._resetSeqTo = nextExpectedSeq;
    this._resetRepairSeqTo = nextExpectedSeq - 1;
  }

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
        heldMask: this._localHeldMask,
        inputSeq: this._inputSeq,
        rawBytes: state.byteLength,
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
    this.clearPendingDisconnect();
    this.stopRepairSyncLoop();
    this.stopVideoStreaming();
    this.inputDc?.close();
    this.controlDc?.close();
    this.stateDc?.close();
    this.repairDc?.close();
    this.chatDc?.close();
    this.pc?.close();
    for (const spectator of this._spectatorPeers.values()) {
      spectator.chatDc?.close();
      spectator.controlDc?.close();
      spectator.pc.close();
    }
    this.signaling.close();
    this.inputDc = null;
    this.controlDc = null;
    this.stateDc = null;
    this.repairDc = null;
    this.chatDc = null;
    this.pc = null;
    this._gameplayConnected = false;
    this._gameplayTransportState = "closed";
    this._sessionStarted = false;
    this._pendingSpectatorInfos.clear();
    this._spectatorVideoReady = false;
    this._spectatorPeers.clear();
    this._stream = null;
  }

  private clearPendingDisconnect() {
    if (this._disconnectTimer) {
      clearTimeout(this._disconnectTimer);
      this._disconnectTimer = null;
    }
    this._disconnectReason = null;
  }

  private scheduleDisconnect(reason: string) {
    if (this._closing || this._disconnectTimer) {
      return;
    }

    this._disconnectReason = reason;
    console.warn(
      `[PEER] scheduling disconnect in ${GAMEPLAY_DISCONNECT_GRACE_MS}ms (${reason})`,
    );

    this._disconnectTimer = setTimeout(() => {
      this._disconnectTimer = null;
      const pendingReason = this._disconnectReason;
      this._disconnectReason = null;

      if (this._closing) {
        return;
      }

      console.warn(`[PEER] disconnect grace expired (${pendingReason ?? "unknown"})`);
      this.handler.onDisconnected();
    }, GAMEPLAY_DISCONNECT_GRACE_MS);
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

      case "room-lobby-updated":
        this.handler.onRoomLobbyUpdated?.({
          code: msg.code,
          roomState: msg.roomState,
          romFilename: msg.romFilename,
          romPath: msg.romPath,
          core: msg.core,
          bios: msg.bios,
          isPublic: msg.isPublic,
          participants: msg.participants,
          canStart: msg.canStart,
          hasGuest: msg.hasGuest,
          spectatorSlotsRemaining: msg.spectatorSlotsRemaining,
          roleLocked: msg.roleLocked,
        });
        break;

      case "guest-joined":
        this._guestProfile = {
          nickname: msg.guestNickname,
          avatar: msg.guestAvatar,
        };
        this.handler.onGuestJoined?.(msg as { guestNickname?: string; guestAvatar?: string });
        break;

      case "spectator-joined":
        if (this._connectionMode === "host") {
          const pendingInfo: PendingSpectatorInfo = {
            spectatorId: msg.spectatorId,
            spectatorNickname: msg.spectatorNickname,
            spectatorAvatar: msg.spectatorAvatar,
          };

          this._pendingSpectatorInfos.set(msg.spectatorId, pendingInfo);

          if (this._sessionStarted) {
            this.createSpectatorConnection(pendingInfo);
          }
        }
        break;

      case "spectator-disconnected":
        if (this._connectionMode === "host") {
          this._pendingSpectatorInfos.delete(msg.spectatorId);
          this.cleanupSpectatorPeer(msg.spectatorId);
        }
        break;

      case "room-session-started":
        this._sessionStarted = true;

        if (this._connectionMode === "host") {
          if (this._stream) {
            void this.startAsHost();
            for (const spectator of this._pendingSpectatorInfos.values()) {
              this.createSpectatorConnection(spectator);
            }
          } else {
            console.log("[PEER] room-session-started: waiting for host stream before creating main offer");
          }
        }

        this.handler.onSessionStarted?.({
          code: msg.code,
          role: msg.role,
          romFilename: msg.romFilename,
          romPath: msg.romPath,
          core: msg.core,
          bios: msg.bios,
          hostNickname: msg.hostNickname,
          hostAvatar: msg.hostAvatar,
        });
        break;

      case "room-kicked":
        this.handler.onRoomKicked?.(msg.message);
        break;

      case "offer":
        if (msg.spectatorId && this._connectionMode === "spectator") {
          if (this.pc) {
            this.handleRenegotiationOffer(msg.sdp);
          } else {
            this.handleOffer(msg.sdp);
          }
        } else if (this.pc) {
          // Renegotiation on existing connection
          this.handleRenegotiationOffer(msg.sdp);
        } else {
          this.handleOffer(msg.sdp);
        }
        break;

      case "answer":
        if (msg.spectatorId) {
          this.handleSpectatorAnswer(msg.spectatorId, msg.sdp);
        } else {
          this.pc?.setRemoteDescription(msg.sdp);
        }
        break;

      case "ice-candidate":
        if (msg.spectatorId) {
          this.handleSpectatorIceCandidate(msg.spectatorId, msg.candidate);
        } else {
          this.pc?.addIceCandidate(msg.candidate);
        }
        break;

      case "peer-disconnected":
        if (!this._closing) this.handler.onDisconnected();
        break;

      case "error":
        this.handler.onError(msg.message);
        break;
    }
  };

  private setupPeerConnection(): RTCPeerConnection {
    const pc = new RTCPeerConnection(this._rtcConfig);
    this.pc = pc;

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        this.signaling.send({ type: "ice-candidate", candidate: e.candidate.toJSON() });
      }
    };

    pc.ontrack = (e) => {
      console.log("[PEER] ontrack fired, streams:", e.streams.length);
      if (e.track.kind === "video") {
        this.applyLowLatencyReceiverSettings(e.receiver);
      }
      const stream = e.streams && e.streams.length > 0 ? e.streams[0] : new MediaStream([e.track]);

      if (this._connectionMode === "spectator" && e.track.kind === "video") {
        this._spectatorVideoReady = true;
        e.track.addEventListener("ended", () => {
          this._spectatorVideoReady = false;
          this.emitGameplayTransportState();
        });
        this.emitGameplayTransportState();
      }

      this.handler.onVideoStream?.(stream);
    };

    pc.onnegotiationneeded = async () => {
      if (this.pc !== pc || this._closing) {
        return;
      }

      if (this._negotiating) return;
      this._negotiating = true;
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        if (this.pc !== pc || this._closing || !pc.localDescription) {
          return;
        }

        this.signaling.send({ type: "offer", sdp: pc.localDescription });
      } catch (err) {
        console.warn("[PEER] onnegotiationneeded renegotiation failed:", err);
      } finally {
        this._negotiating = false;
      }
    };

    pc.onconnectionstatechange = () => {
      if (this.pc !== pc) {
        return;
      }

      console.log("[PEER] main pc connection state:", pc.connectionState);

      if (pc.connectionState === "connected") {
        this.clearPendingDisconnect();
        return;
      }

      if (pc.connectionState === "disconnected" || pc.connectionState === "failed") {
        if (!this._closing && this._gameplayConnected) {
          this._gameplayConnected = false;
          this.scheduleDisconnect(`pc:${pc.connectionState}`);
        }
      }
    };

    return pc;
  }

  private emitGameplayTransportState() {
    if (this._connectionMode === "spectator") {
      const controlState = this.controlDc?.readyState ?? "closed";
      let nextState: GameplayTransportState = "closed";

      if (controlState === "open" && this._spectatorVideoReady) {
        nextState = "open";
      } else if (controlState === "closing") {
        nextState = "closing";
      } else if (controlState === "connecting" || controlState === "open") {
        nextState = "connecting";
      }

      if (nextState !== this._gameplayTransportState) {
        this._gameplayTransportState = nextState;
        this.handler.onDataChannelState?.(nextState);
      }

      if (!this._gameplayConnected && nextState === "open") {
        this.clearPendingDisconnect();
        this._gameplayConnected = true;
        this.handler.onConnected();
        return;
      }

      if (this._gameplayConnected && nextState !== "open" && !this._closing) {
        this._gameplayConnected = false;
        this.scheduleDisconnect(`spectator-transport:${nextState}`);
        return;
      }

      this._gameplayConnected = nextState === "open";
      return;
    }

    const inputState = this.inputDc?.readyState ?? "closed";
    const controlState = this.controlDc?.readyState ?? "closed";
    const stateState = this.stateDc?.readyState ?? "closed";

    let nextState: GameplayTransportState = "closed";
    if (inputState === "open" && controlState === "open" && stateState === "open") {
      nextState = "open";
    } else if (inputState === "closing" || controlState === "closing" || stateState === "closing") {
      nextState = "closing";
    } else if (
      inputState === "connecting" ||
      controlState === "connecting" ||
      stateState === "connecting" ||
      inputState === "open" ||
      controlState === "open" ||
      stateState === "open"
    ) {
      nextState = "connecting";
    }

    if (nextState !== this._gameplayTransportState) {
      console.log("[PEER] gameplay transport state:", nextState);
      this._gameplayTransportState = nextState;
      this.handler.onDataChannelState?.(nextState);
    }

    if (!this._gameplayConnected && nextState === "open") {
      this.clearPendingDisconnect();
      this._gameplayConnected = true;
      this.handler.onConnected();
      return;
    }

    if (this._gameplayConnected && nextState !== "open" && !this._closing) {
      this._gameplayConnected = false;
      this.scheduleDisconnect(`transport:${nextState}`);
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
          if (this._resetSeqTo !== null) {
            expectedSeq = this._resetSeqTo;
            this._resetSeqTo = null;
          }
          if (inp.seq < expectedSeq) {
            console.log(`[PEER] ignoring stale input seq ${inp.seq} (< ${expectedSeq})`);
            return;
          }
          if (inp.seq !== expectedSeq) {
            console.warn(`[PEER] input seq gap: expected ${expectedSeq}, got ${inp.seq}`);
            this.handler.onInputSeqGap?.(expectedSeq, inp.seq);
          }
          expectedSeq = inp.seq + 1;
          this.handler.onInput(inp);
        }
      } catch {
        /* ignore */
      }
    };
  }

  private setupControlDataChannel(dc: RTCDataChannel) {
    this.controlDc = dc;
    this.emitGameplayTransportState();

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
        if (msg.type === "peer-ready") {
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
        } else if (msg.type === "heartbeat") {
          this.handler.onHeartbeat?.(msg.ts);
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
          const chunk = new Uint8Array(e.data);
          const nextOffset = Math.min(
            pendingResync.writeOffset + chunk.byteLength,
            pendingResync.totalBytes,
          );
          pendingResync.buffer.set(
            chunk.subarray(0, nextOffset - pendingResync.writeOffset),
            pendingResync.writeOffset,
          );
          pendingResync.writeOffset = nextOffset;
          pendingResync.bytesReceived += chunk.byteLength;
          pendingResync.chunksReceived += 1;
          if (
            pendingResync.chunksReceived >= pendingResync.chunks ||
            pendingResync.writeOffset >= pendingResync.totalBytes
          ) {
            const full = pendingResync.buffer;
            const wasCompressed = pendingResync.compressed;
            const remoteHeldMask = pendingResync.heldMask;
            const remoteInputSeq = pendingResync.inputSeq;
            const compressedBytes = pendingResync.totalBytes;
            const rawBytes = pendingResync.rawBytes;
            const receiveMs = Math.max(0, performance.now() - pendingResync.startedAt);
            pendingResync = null;
            if (wasCompressed) {
              const inflateStartedAt = performance.now();
              const decompressed = inflate(full);
              this.handler.onResyncState?.({
                stateBuffer: decompressed.buffer,
                remoteHeldMask,
                remoteInputSeq,
                stats: {
                  compressedBytes,
                  decompressMs: Math.max(0, performance.now() - inflateStartedAt),
                  rawBytes: decompressed.byteLength || rawBytes,
                  receiveMs,
                },
              });
            } else {
              this.handler.onResyncState?.({
                stateBuffer: full.buffer as ArrayBuffer,
                remoteHeldMask,
                remoteInputSeq,
                stats: {
                  compressedBytes,
                  decompressMs: 0,
                  rawBytes,
                  receiveMs,
                },
              });
            }
          }
          return;
        }

        if (!pendingState) return;

        const chunk = new Uint8Array(e.data);
        const nextOffset = Math.min(
          pendingState.writeOffset + chunk.byteLength,
          pendingState.totalBytes,
        );
        pendingState.buffer.set(
          chunk.subarray(0, nextOffset - pendingState.writeOffset),
          pendingState.writeOffset,
        );
        pendingState.writeOffset = nextOffset;
        pendingState.bytesReceived += chunk.byteLength;
        pendingState.chunksReceived += 1;
        if (
          pendingState.chunksReceived >= pendingState.chunks ||
          pendingState.writeOffset >= pendingState.totalBytes
        ) {
          const full = pendingState.buffer;
          pendingState = null;
          this.handler.onSaveState?.(full.buffer as ArrayBuffer);
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
            buffer: new Uint8Array(msg.totalBytes),
            bytesReceived: 0,
            chunksReceived: 0,
            writeOffset: 0,
          };
        } else if (msg.type === "resync-state-header") {
          pendingResync = {
            totalBytes: msg.totalBytes,
            chunks: msg.chunks,
            buffer: new Uint8Array(msg.totalBytes),
            bytesReceived: 0,
            chunksReceived: 0,
            writeOffset: 0,
            compressed: !!msg.compressed,
            heldMask: typeof msg.heldMask === "number" ? msg.heldMask : DEFAULT_REMOTE_HELD_MASK,
            inputSeq: typeof msg.inputSeq === "number" ? msg.inputSeq : 0,
            rawBytes: typeof msg.rawBytes === "number" ? msg.rawBytes : msg.totalBytes,
            startedAt: performance.now(),
          };
        }
      } catch {
        /* ignore */
      }
    };
  }

  private setupRepairDataChannel(dc: RTCDataChannel) {
    this.repairDc = dc;

    let latestSeq = 0;

    dc.onopen = () => {
      this.updateRepairSyncLoop();
      this.sendRepairSync();
    };

    dc.onclose = () => {
      this.stopRepairSyncLoop();
    };

    dc.onmessage = (e) => {
      if (typeof e.data !== "string") return;

      try {
        const msg = JSON.parse(e.data) as InputSyncMessage;
        if (msg.type !== "input-sync") return;

        if (this._resetRepairSeqTo !== null) {
          latestSeq = Math.max(latestSeq, this._resetRepairSeqTo);
          this._resetRepairSeqTo = null;
        }

        if (msg.seq < latestSeq) {
          return;
        }

        latestSeq = Math.max(latestSeq, msg.seq);
        this.handler.onRemoteHeldMask?.(msg.heldMask);
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
          const chatMessage = this.normalizeIncomingChatMessage(msg);
          if (!chatMessage) return;

          if (this._connectionMode === "host") {
            const guestMessage: ChatMessage = {
              ...chatMessage,
              authorName: this._guestProfile?.nickname || chatMessage.authorName || "게스트",
              authorAvatar: this._guestProfile?.avatar || chatMessage.authorAvatar || "🎮",
              authorRole: "guest",
            };

            this.handler.onChatMessage?.(guestMessage);
            this.broadcastChatToSpectators(guestMessage);
            return;
          }

          this.handler.onChatMessage?.(chatMessage);
        } else if (msg.type === "chat-typing") {
          this.handler.onChatTyping?.(!!msg.isTyping);
        }
      } catch {
        /* ignore */
      }
    };
  }

  private async startAsHost() {
    if (this.pc || this._closing) {
      return;
    }

    const pc = this.setupPeerConnection();

    if (this._closing) {
      return;
    }

    this._negotiating = true;

    try {
      const inputDc = pc.createDataChannel(INPUT_CHANNEL_LABEL, {
        ordered: false,
        maxRetransmits: 0,
      });
      const controlDc = pc.createDataChannel(CONTROL_CHANNEL_LABEL);
      const stateDc = pc.createDataChannel(STATE_CHANNEL_LABEL);
      const repairDc = pc.createDataChannel(REPAIR_CHANNEL_LABEL, {
        ordered: false,
        maxRetransmits: 0,
      });
      const chatDc = pc.createDataChannel(CHAT_CHANNEL_LABEL);
      this.setupInputDataChannel(inputDc);
      this.setupControlDataChannel(controlDc);
      this.setupStateDataChannel(stateDc);
      this.setupRepairDataChannel(repairDc);
      this.setupChatDataChannel(chatDc);

      if (this._stream) {
        this.replaceStreamTracks(pc, this._videoSenders, this._stream);
      }

      if (this.pc !== pc || this._closing) {
        return;
      }

      const activePc: RTCPeerConnection = pc;
      const offer = await activePc.createOffer();
      await activePc.setLocalDescription(offer);

      if (this.pc !== activePc || this._closing || !activePc.localDescription) {
        return;
      }

      this.signaling.send({ type: "offer", sdp: activePc.localDescription });
    } finally {
      this._negotiating = false;
    }
  }

  private async handleOffer(sdp: RTCSessionDescriptionInit) {
    if (this._connectionMode === "spectator") {
      this._spectatorVideoReady = false;
    }

    const pc = this.setupPeerConnection();

    pc.ondatachannel = (e) => {
      if (e.channel.label === CHAT_CHANNEL_LABEL) {
        this.setupChatDataChannel(e.channel);
        return;
      }

      if (e.channel.label === INPUT_CHANNEL_LABEL) {
        if (this._connectionMode === "spectator") {
          return;
        }
        this.setupInputDataChannel(e.channel);
        return;
      }

      if (e.channel.label === CONTROL_CHANNEL_LABEL) {
        this.setupControlDataChannel(e.channel);
        return;
      }

      if (e.channel.label === STATE_CHANNEL_LABEL) {
        if (this._connectionMode === "spectator") {
          return;
        }
        this.setupStateDataChannel(e.channel);
        return;
      }

      if (e.channel.label === REPAIR_CHANNEL_LABEL) {
        if (this._connectionMode === "spectator") {
          return;
        }
        this.setupRepairDataChannel(e.channel);
      }
    };

    await pc.setRemoteDescription(sdp);
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    this.signaling.send({ type: "answer", sdp: pc.localDescription! });
  }

  private async handleRenegotiationOffer(sdp: RTCSessionDescriptionInit) {
    if (!this.pc) return;
    try {
      await this.pc.setRemoteDescription(sdp);
      const answer = await this.pc.createAnswer();
      await this.pc.setLocalDescription(answer);
      this.signaling.send({ type: "answer", sdp: this.pc.localDescription! });
      console.log("[PEER] Renegotiation answer sent");
    } catch (err) {
      console.warn("[PEER] Renegotiation failed:", err);
    }
  }

  private normalizeIncomingChatMessage(msg: Record<string, unknown>): ChatMessage | null {
    const text = typeof msg.text === "string" ? msg.text.trim().slice(0, 300) : "";
    if (!text) {
      return null;
    }

    const authorRole =
      msg.authorRole === "host" || msg.authorRole === "guest" || msg.authorRole === "spectator"
        ? msg.authorRole
        : undefined;

    return {
      id: typeof msg.id === "string" ? msg.id : `chat-${Date.now()}`,
      text,
      sentAt: typeof msg.sentAt === "number" ? msg.sentAt : Date.now(),
      authorAvatar: typeof msg.authorAvatar === "string" ? msg.authorAvatar : undefined,
      authorName: typeof msg.authorName === "string" ? msg.authorName : undefined,
      authorRole,
    };
  }

  private broadcastChatToGuest(message: ChatMessage) {
    if (this.chatDc?.readyState !== "open") {
      return;
    }

    this.chatDc.send(JSON.stringify({ type: "chat-message", ...message }));
  }

  private broadcastChatToSpectators(message: ChatMessage, excludedSpectatorId?: string) {
    for (const spectator of this._spectatorPeers.values()) {
      if (spectator.id === excludedSpectatorId) {
        continue;
      }

      if (spectator.chatDc?.readyState === "open") {
        spectator.chatDc.send(JSON.stringify({ type: "chat-message", ...message }));
      }
    }
  }

  private createSpectatorConnection(info: {
    spectatorId: string;
    spectatorNickname?: string;
    spectatorAvatar?: string;
  }) {
    if (this._spectatorPeers.has(info.spectatorId)) {
      return;
    }

    const pc = new RTCPeerConnection(this._rtcConfig);
    const spectator: SpectatorPeerState = {
      id: info.spectatorId,
      nickname: info.spectatorNickname,
      avatar: info.spectatorAvatar,
      pc,
      chatDc: null,
      controlDc: null,
      senders: [],
      negotiating: false,
      negotiationQueued: false,
    };

    this._spectatorPeers.set(spectator.id, spectator);

    this.applyPreferredVideoCodecs(pc);

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.signaling.send({
          type: "ice-candidate",
          candidate: event.candidate.toJSON(),
          spectatorId: spectator.id,
        });
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "disconnected" || pc.connectionState === "failed") {
        this.cleanupSpectatorPeer(spectator.id);
      }
    };

    pc.onnegotiationneeded = async () => {
      await this.requestSpectatorNegotiation(spectator);
    };

    const controlDc = pc.createDataChannel(CONTROL_CHANNEL_LABEL);
    spectator.controlDc = controlDc;
    controlDc.onopen = () => undefined;
    controlDc.onclose = () => undefined;

    const chatDc = pc.createDataChannel(CHAT_CHANNEL_LABEL);
    spectator.chatDc = chatDc;
    chatDc.onmessage = (event) => {
      if (typeof event.data !== "string") {
        return;
      }

      try {
        const msg = JSON.parse(event.data);
        if (msg.type !== "chat-message") {
          return;
        }

        const chatMessage = this.normalizeIncomingChatMessage(msg);
        if (!chatMessage) {
          return;
        }

        const spectatorMessage: ChatMessage = {
          ...chatMessage,
          authorName: spectator.nickname || chatMessage.authorName || "관전자",
          authorAvatar: spectator.avatar || chatMessage.authorAvatar || "👀",
          authorRole: "spectator",
        };

        this.handler.onChatMessage?.(spectatorMessage);
        this.broadcastChatToGuest(spectatorMessage);
        this.broadcastChatToSpectators(spectatorMessage, spectator.id);
      } catch {
        /* ignore */
      }
    };

    if (this._stream) {
      this.replaceStreamTracks(pc, spectator.senders, this._stream);
    }

    void this.requestSpectatorNegotiation(spectator);
  }

  private cleanupSpectatorPeer(spectatorId: string) {
    const spectator = this._spectatorPeers.get(spectatorId);
    if (!spectator) {
      return;
    }

    spectator.chatDc?.close();
    spectator.controlDc?.close();
    this.removeStreamTracks(spectator.pc, spectator.senders);
    spectator.pc.close();
    this._spectatorPeers.delete(spectatorId);
  }

  private handleSpectatorAnswer(spectatorId: string, sdp: RTCSessionDescriptionInit) {
    const spectator = this._spectatorPeers.get(spectatorId);
    if (!spectator) {
      return;
    }

    void spectator.pc
      .setRemoteDescription(sdp)
      .then(() => {
        if (spectator.negotiationQueued && spectator.pc.signalingState === "stable") {
          spectator.negotiationQueued = false;
          return this.requestSpectatorNegotiation(spectator);
        }

        return undefined;
      })
      .catch(() => undefined);
  }

  private async requestSpectatorNegotiation(spectator: SpectatorPeerState) {
    if (spectator.pc.connectionState === "closed") {
      spectator.negotiationQueued = false;
      return;
    }

    if (spectator.negotiating || spectator.pc.signalingState !== "stable") {
      spectator.negotiationQueued = true;
      return;
    }

    spectator.negotiating = true;

    try {
      const offer = await spectator.pc.createOffer();
      await spectator.pc.setLocalDescription(offer);
      this.signaling.send({
        type: "offer",
        sdp: spectator.pc.localDescription!,
        spectatorId: spectator.id,
      });
    } catch (error) {
      console.warn("[PEER] spectator renegotiation failed:", error);
    } finally {
      spectator.negotiating = false;

      if (spectator.negotiationQueued) {
        spectator.negotiationQueued = false;
        queueMicrotask(() => {
          void this.requestSpectatorNegotiation(spectator);
        });
      }
    }
  }

  private handleSpectatorIceCandidate(spectatorId: string, candidate: RTCIceCandidateInit) {
    const spectator = this._spectatorPeers.get(spectatorId);
    if (!spectator) {
      return;
    }

    void spectator.pc.addIceCandidate(candidate).catch(() => undefined);
  }

  private applyPreferredVideoCodecs(pc: RTCPeerConnection) {
    try {
      const txv = pc.addTransceiver("video", { direction: "sendrecv" });
      const codecs = RTCRtpReceiver.getCapabilities?.("video")?.codecs ?? [];
      const h264 = codecs.filter((codec) => codec.mimeType === "video/H264");
      const rest = codecs.filter((codec) => codec.mimeType !== "video/H264");
      if (h264.length > 0) {
        txv.setCodecPreferences([...h264, ...rest]);
      }
    } catch {
      /* ignore */
    }
  }

  private applyLowLatencyReceiverSettings(receiver: RTCRtpReceiver | null | undefined) {
    if (!receiver) {
      return;
    }

    try {
      const receiverWithDelayHint = receiver as RTCRtpReceiver & {
        playoutDelayHint?: number;
      };

      if ("playoutDelayHint" in receiverWithDelayHint) {
        receiverWithDelayHint.playoutDelayHint = VIDEO_STREAM_PLAYOUT_DELAY_SEC;
      }
    } catch {
      /* ignore */
    }
  }

  private replaceStreamTracks(
    pc: RTCPeerConnection | null,
    senders: RTCRtpSender[],
    stream: MediaStream,
  ) {
    if (!pc) {
      return;
    }

    this.removeStreamTracks(pc, senders);

    for (const track of stream.getVideoTracks()) {
      track.contentHint = "motion";
      const sender = pc.addTrack(track, stream);
      senders.push(sender);

      try {
        const params = sender.getParameters();
        const encodings = params.encodings && params.encodings.length > 0 ? params.encodings : [{}];
        params.encodings = encodings;
        params.encodings[0].maxBitrate = VIDEO_STREAM_MAX_BITRATE;
        params.encodings[0].maxFramerate = VIDEO_STREAM_MAX_FRAMERATE;
        params.encodings[0].scaleResolutionDownBy = VIDEO_STREAM_SCALE_DOWN;
        params.degradationPreference = "maintain-framerate";
        void sender.setParameters(params).catch(() => undefined);
      } catch {
        /* ignore */
      }
    }

    for (const track of stream.getAudioTracks()) {
      if (track.readyState !== "live" || !track.enabled) {
        continue;
      }

      track.contentHint = "music";
      senders.push(pc.addTrack(track, stream));
    }
  }

  private removeStreamTracks(pc: RTCPeerConnection | null, senders: RTCRtpSender[]) {
    if (!pc) {
      senders.length = 0;
      return;
    }

    for (const sender of senders) {
      try {
        pc.removeTrack(sender);
      } catch {
        /* ignore */
      }
    }

    senders.length = 0;
  }

  private sendRepairSync() {
    if (this.repairDc?.readyState !== "open") return;

    const message: InputSyncMessage = {
      type: "input-sync",
      heldMask: this._localHeldMask,
      seq: this._inputSeq,
    };

    this.repairDc.send(JSON.stringify(message));
  }

  private updateRepairSyncLoop() {
    if (this._localHeldMask !== 0) {
      this._repairZeroFlushRemaining = REPAIR_SYNC_ZERO_FLUSH_COUNT;
    } else if (this._repairZeroFlushRemaining === 0) {
      this._repairZeroFlushRemaining = REPAIR_SYNC_ZERO_FLUSH_COUNT;
    }

    if (this.repairDc?.readyState !== "open") return;
    if (this._repairSyncTimer) return;

    this._repairSyncTimer = setInterval(() => {
      if (this.repairDc?.readyState !== "open") {
        this.stopRepairSyncLoop();
        return;
      }

      if (this._localHeldMask === 0 && this._repairZeroFlushRemaining <= 0) {
        this.stopRepairSyncLoop();
        return;
      }

      this.sendRepairSync();

      if (this._localHeldMask === 0) {
        this._repairZeroFlushRemaining -= 1;
      } else {
        this._repairZeroFlushRemaining = REPAIR_SYNC_ZERO_FLUSH_COUNT;
      }
    }, REPAIR_SYNC_INTERVAL_MS);
  }

  private stopRepairSyncLoop() {
    if (this._repairSyncTimer) {
      clearInterval(this._repairSyncTimer);
      this._repairSyncTimer = null;
    }
    this._repairZeroFlushRemaining = 0;
  }
}

function updateHeldMask(mask: number, button: number, down: boolean) {
  if (button < 0 || button > 30) return mask;
  const bit = 1 << button;
  return down ? mask | bit : mask & ~bit;
}
