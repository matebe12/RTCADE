import {
  SignalingClient,
  type RoomLobbySnapshotMessage,
  type RoomSessionStartedMessage,
  type SignalingMessage,
} from "./signaling";

/** HOST를 포함한 입력 메시지. DataChannel `input`으로 전송된다. */
export type InputMessage = {
  type: "input";
  button: number;
  down: boolean;
  heldMask: number;
  seq: number;
  sentAt: number;
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

/** 채팅 메시지. DataChannel `chat`으로 전송된다. */
export type ChatMessage = {
  id: string;
  text: string;
  sentAt: number;
  authorAvatar?: string;
  authorName?: string;
  authorRole?: "host" | "guest" | "spectator";
};

/** 엄보에 대한 코렇션 메시지. `repair` DataChannel으로 120ms 주기로 전송한다. */
export type InputSyncMessage = {
  type: "input-sync";
  heldMask: number;
  seq: number;
};

type InputAckMessage = {
  type: "input-ack";
  seq: number;
  sentAt: number;
};

/** 네트워크 품질 등급. RTT 및 입력 버퍼 상태를 기반으로 산정한다. */
export type NetplayNetworkQuality = "unknown" | "good" | "unstable" | "poor";

/** WebRTC ICE 코디이트 유형. `relay`는 TURN 서버 경유를 의미한다. */
export type NetplayCandidateType = "host" | "srflx" | "prflx" | "relay" | "unknown";

/** 네트워크 통계 스냅샷. 1초 주기로 수집되다. */
export type NetplayNetworkStats = {
  sampledAt: number;
  quality: NetplayNetworkQuality;
  rttMs: number | null;
  jitterMs: number | null;
  packetLossPercent: number | null;
  availableOutgoingBitrateKbps: number | null;
  videoBitrateKbps: number | null;
  videoFps: number | null;
  videoFramesDropped: number | null;
  inputRoundTripMs: number | null;
  inputSeqGapCount: number;
  staleInputDropCount: number;
  staleRepairDropCount: number;
  inputBufferedBytes: number;
  controlBufferedBytes: number;
  repairBufferedBytes: number;
  chatBufferedBytes: number;
  localCandidateType: NetplayCandidateType;
  remoteCandidateType: NetplayCandidateType;
};

/**
 * NetplayPeer 이벤트 콜백 인터페이스.
 * `useNetplayPeerFactory`에서 모든 콜백을 연결한 후 `NetplayPeer` 생성시 주입한다.
 */
export type PeerEventHandler = {
  /** P2P 연결이 열렸다. */
  onConnected: () => void;
  /** P2P 연결이 닫혔다. */
  onDisconnected: () => void;
  /** 원격 플레이어의 입력 메시지를 수신했다. */
  onInput: (msg: InputMessage) => void;
  /** 에러가 발생했다. */
  onError: (msg: string) => void;
  /** GUEST가 방에 열린다 (HOST 측). */
  onGuestJoined?: (info: { guestNickname?: string; guestAvatar?: string }) => void;
  /** 방이 생성되었다 (HOST 측). */
  onRoomCreated?: (code: string) => void;
  /** 방에 입장했다 (GUEST/관전자 측). */
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
  /** DataChannel이 열리면 게임플레이어가 준비 완료 신호를 보냈다. */
  onPeerReady?: () => void;
  /** HOST에서 "go" 신호를 수신했다 (GUEST 측). */
  onStartSignal?: () => void;
  /** 입력 시퀀스 공백이 감지되었다. 네트워크 유실 검사용. */
  onInputSeqGap?: (expected: number, got: number) => void;
  onRemoteHeldMask?: (heldMask: number) => void;
  onChatChannelState?: (state: string) => void;
  onChatMessage?: (msg: ChatMessage) => void;
  onChatTyping?: (isTyping: boolean) => void;
  onVideoStream?: (stream: MediaStream) => void;
  onNetworkStats?: (stats: NetplayNetworkStats) => void;
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

type StatsRecord = RTCStats & Record<string, unknown>;

type VideoStatsDirection = "outbound" | "inbound";

type VideoBitrateSample = {
  bytes: number;
  direction: VideoStatsDirection;
  sampledAt: number;
};

type VideoFrameSample = {
  direction: VideoStatsDirection;
  frames: number;
  sampledAt: number;
};

type PacketLossSample = {
  packetsLost: number;
  packetsTotal: number;
};

const INPUT_CHANNEL_LABEL = "input";
const CONTROL_CHANNEL_LABEL = "control";
const REPAIR_CHANNEL_LABEL = "repair";
const CHAT_CHANNEL_LABEL = "chat";
const CHAT_BUFFER_THRESHOLD = 64 * 1024;
const NETWORK_STATS_INTERVAL_MS = 1_000;
const INPUT_BUFFER_UNSTABLE_THRESHOLD = 4 * 1024;
const INPUT_BUFFER_POOR_THRESHOLD = 16 * 1024;
const INPUT_BUFFER_SEND_THRESHOLD = 8 * 1024;
const REPAIR_SYNC_INTERVAL_MS = 120;
const REPAIR_SYNC_ZERO_FLUSH_COUNT = 3;
const VIDEO_STREAM_MAX_BITRATE = 2_500_000;
const VIDEO_STREAM_MAX_FRAMERATE = 60;
const VIDEO_STREAM_SCALE_DOWN = 2.0;
const VIDEO_STREAM_PLAYOUT_DELAY_SEC = 0;
const GAMEPLAY_DISCONNECT_GRACE_MS = 4_000;

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }, { urls: "stun:stun1.l.google.com:19302" }],
};

function asStatsRecord(stats: RTCStats): StatsRecord {
  return stats as StatsRecord;
}

function readNumber(stats: StatsRecord, key: string) {
  const value = stats[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function readString(stats: StatsRecord, key: string) {
  const value = stats[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

function normalizeCandidateType(value: string | null): NetplayCandidateType {
  if (value === "host" || value === "srflx" || value === "prflx" || value === "relay") {
    return value;
  }

  return "unknown";
}

function toRoundedMs(seconds: number | null) {
  return seconds === null ? null : Math.max(0, Math.round(seconds * 1000));
}

function getRtpKind(stats: StatsRecord) {
  return readString(stats, "kind") ?? readString(stats, "mediaType");
}

function getPacketLossSample(stats: StatsRecord): PacketLossSample | null {
  const packetsLost = readNumber(stats, "packetsLost");
  const packetsReceived = readNumber(stats, "packetsReceived");

  if (packetsLost === null || packetsReceived === null) {
    return null;
  }

  const safePacketsLost = Math.max(0, packetsLost);
  const packetsTotal = Math.max(0, packetsReceived + safePacketsLost);

  if (packetsTotal <= 0) {
    return null;
  }

  return {
    packetsLost: safePacketsLost,
    packetsTotal,
  };
}

function computeNetworkQuality(stats: Omit<NetplayNetworkStats, "quality">): NetplayNetworkQuality {
  const hasSignal =
    stats.rttMs !== null ||
    stats.jitterMs !== null ||
    stats.packetLossPercent !== null ||
    stats.availableOutgoingBitrateKbps !== null ||
    stats.videoBitrateKbps !== null ||
    stats.videoFps !== null;

  if (!hasSignal) {
    return "unknown";
  }

  if (
    (stats.rttMs !== null && stats.rttMs >= 180) ||
    (stats.jitterMs !== null && stats.jitterMs >= 60) ||
    (stats.packetLossPercent !== null && stats.packetLossPercent >= 3) ||
    (stats.videoFps !== null && stats.videoFps < 20) ||
    (stats.inputRoundTripMs !== null && stats.inputRoundTripMs >= 180) ||
    stats.inputBufferedBytes >= INPUT_BUFFER_POOR_THRESHOLD
  ) {
    return "poor";
  }

  if (
    (stats.rttMs !== null && stats.rttMs >= 100) ||
    (stats.jitterMs !== null && stats.jitterMs >= 30) ||
    (stats.packetLossPercent !== null && stats.packetLossPercent >= 1) ||
    (stats.videoFps !== null && stats.videoFps < 32) ||
    (stats.inputRoundTripMs !== null && stats.inputRoundTripMs >= 100) ||
    stats.inputBufferedBytes >= INPUT_BUFFER_UNSTABLE_THRESHOLD
  ) {
    return "unstable";
  }

  return "good";
}

/**
 * WebRTC 기반 P2P 넷플레이 코어 클래스.
 * 시그널링 연결, RTCPeerConnection 관리, DataChannel (input/control/repair/chat),
 * 비디오 스트리밍, 관전자 지원, 네트워크 통계 수집을 담당한다.
 */
export class NetplayPeer {
  private signaling: SignalingClient;
  private pc: RTCPeerConnection | null = null;
  private inputDc: RTCDataChannel | null = null;
  private controlDc: RTCDataChannel | null = null;
  private repairDc: RTCDataChannel | null = null;
  private chatDc: RTCDataChannel | null = null;
  private handler: PeerEventHandler;
  private _closing = false;
  private _chatSeq = 0;
  private _lastTypingState: boolean | null = null;
  private _gameplayTransportState: GameplayTransportState = "closed";
  private _gameplayConnected = false;
  private _localHeldMask = 0;
  private _remoteExpectedInputSeq = 1;
  private _remoteAppliedInputSeq = 0;
  private _inputSeqGapCount = 0;
  private _staleInputDropCount = 0;
  private _staleRepairDropCount = 0;
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
  private _networkStatsTimer: ReturnType<typeof setInterval> | null = null;
  private _networkStatsPolling = false;
  private _lastVideoBitrateSample: VideoBitrateSample | null = null;
  private _lastVideoFrameSample: VideoFrameSample | null = null;
  private _lastPacketLossSample: PacketLossSample | null = null;
  private _lastInputRoundTripMs: number | null = null;

  constructor(handler: PeerEventHandler, rtcConfig: RTCConfiguration = RTC_CONFIG) {
    this.handler = handler;
    this._rtcConfig = rtcConfig;
    this.signaling = new SignalingClient(this.onSignaling);
  }

  /**
   * 시그널링 서버에 연결한다.
   * @param serverUrl - WebSocket 시그널링 서버 URL
   */
  async connect(serverUrl: string) {
    await this.signaling.connect(serverUrl);
  }

  /**
   * 새 방을 생성한다 (HOST 역할로 등록됨).
   * @param romFilename - ROM 파일명
   * @param core - 에뮬레이터 코어명
   * @param bios - BIOS 경로 (optional)
   * @param nickname - HOST 닉네임
   * @param avatar - HOST 아바타 이모지
   * @param isPublic - 공개 방 여부
   */
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

  /**
   * 기존 방에 입장한다 (GUEST 역할).
   * @param code - 6자리 방 코드
   * @param nickname - GUEST 닉네임
   * @param avatar - GUEST 아바타
   */
  joinRoom(code: string, nickname?: string, avatar?: string) {
    this._connectionMode = "guest";
    this._sessionStarted = false;
    this._localProfile = { nickname, avatar };
    this.signaling.send({ type: "join-room", code, nickname, avatar });
  }

  /**
   * 방을 관전한다 (관전자 역할).
   * @param code - 6자리 방 코드
   * @param nickname - 관전자 닉네임
   * @param avatar - 관전자 아바타
   */
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

  /** 게임 세션이 시작되었음을 마크하고 관전자들에게 통지한다. */
  markSessionStarted() {
    if (this._connectionMode !== "host") {
      return;
    }

    this.signaling.send({ type: "session-started" });
  }

  private _inputSeq = 0;

  /**
   * 버튼 입력 이벤트를 원격 Peer에 전송한다.
   * `repair` DataChannel을 통한 코렇션이 진행 중이면 드락한다.
   * @param button - 버튼 인덱스 (0~11)
   * @param down - 누름 여부
   */
  sendInput(button: number, down: boolean) {
    const nextHeldMask = updateHeldMask(this._localHeldMask, button, down);

    if (nextHeldMask === this._localHeldMask) {
      this.updateRepairSyncLoop();
      return;
    }

    this._localHeldMask = nextHeldMask;
    const seq = ++this._inputSeq;
    const sentAt = performance.now();

    if (this.inputDc?.readyState === "open") {
      if (this.inputDc.bufferedAmount <= INPUT_BUFFER_SEND_THRESHOLD) {
        this.inputDc.send(
          JSON.stringify({
            type: "input",
            button,
            down,
            heldMask: this._localHeldMask,
            seq,
            sentAt,
          }),
        );
      } else {
        console.warn(
          `[PEER] sendInput skipped due to backpressure, buffered=${this.inputDc.bufferedAmount}`,
        );
      }
    }

    this.sendRepairSync();
    this.updateRepairSyncLoop();
  }

  /**
   * 로컈 Peer가 준비 완료되었음을 상대에게 알린다.
   * GUEST는 DataChannel이 열리면 자동으로 호출한다.
   */
  sendPeerReady() {
    console.log("[PEER] sendPeerReady, control dc:", this.controlDc?.readyState);
    if (this.controlDc?.readyState === "open") {
      this.controlDc.send(JSON.stringify({ type: "peer-ready" }));
    }
  }

  // HOST tells GUEST to start the game
  /**
   * HOST가 GUEST에게 게임 시작 신호를 보냈다.
   * GUEST는 이 신호를 받아야 에뮬레이터를 시작한다.
   */
  sendStartSignal() {
    console.log("[PEER] sendStartSignal");
    if (this.controlDc?.readyState === "open") {
      this.controlDc.send(JSON.stringify({ type: "start-signal" }));
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

  /**
   * 채팅 메시지를 전송한다.
   * @param text - 도자 텍스트
   * @returns 전송된 ChatMessage 또는 연결 안됨 시 `null`
   */
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

  /**
   * 로컈 사용자의 타이핑 상태를 상대에게 알린다.
   * @param isTyping - 입력 중이면 `true`
   */
  sendTypingState(isTyping: boolean) {
    if (this.chatDc?.readyState !== "open") return;
    if (this._lastTypingState === isTyping) return;
    this._lastTypingState = isTyping;
    this.chatDc.send(JSON.stringify({ type: "chat-typing", isTyping }));
  }

  /** Add video+audio tracks from a MediaStream to the peer connection and trigger renegotiation */
  /**
   * HOST의 canvas/오디오 MediaStream을 모든 Peer (GUEST, 관전자)에게 스트리밍으로 전송한다.
   * @param stream - 캔버스를 `captureStream()`한 MediaStream
   */
  startVideoStreaming(stream: MediaStream) {
    this._stream = stream;

    if (!this.pc) {
      if (this._connectionMode === "host" && this._sessionStarted) {
        console.log(
          "[PEER] startVideoStreaming: stream ready before main peer offer; starting host connection",
        );
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
  /** Reset remote input sequence counter */
  resetRemoteSeq(nextExpectedSeq: number) {
    const safeNextExpectedSeq = Number.isFinite(nextExpectedSeq)
      ? Math.max(1, Math.floor(nextExpectedSeq))
      : 1;
    const appliedSeqFloor = safeNextExpectedSeq - 1;

    this._remoteExpectedInputSeq = Math.max(this._remoteExpectedInputSeq, safeNextExpectedSeq);
    this._remoteAppliedInputSeq = Math.max(this._remoteAppliedInputSeq, appliedSeqFloor);
  }

  /**
   * Peer 연결을 종료하고 모든 리소스를 정리한다.
   * DataChannel, RTCPeerConnection, 타이머, 시그널링 연결을 전부 닫는다.
   */
  close() {
    this._closing = true;
    this.clearPendingDisconnect();
    this.stopNetworkStatsPolling();
    this.stopRepairSyncLoop();
    this.stopVideoStreaming();
    this.inputDc?.close();
    this.controlDc?.close();
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
    console.warn(`[PEER] scheduling disconnect in ${GAMEPLAY_DISCONNECT_GRACE_MS}ms (${reason})`);

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
            console.log(
              "[PEER] room-session-started: waiting for host stream before creating main offer",
            );
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
    this.resetRemoteInputDiagnostics();
    this.startNetworkStatsPolling(pc);

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

  private startNetworkStatsPolling(pc: RTCPeerConnection) {
    this.stopNetworkStatsPolling();

    const pollNetworkStats = () => {
      if (this.pc !== pc || this._closing || this._networkStatsPolling) {
        return;
      }

      this._networkStatsPolling = true;
      void pc
        .getStats()
        .then((statsReport) => {
          if (this.pc !== pc || this._closing) {
            return;
          }

          this.handler.onNetworkStats?.(this.buildNetworkStats(statsReport));
        })
        .catch(() => {
          /* getStats can fail while the browser is tearing down the connection. */
        })
        .finally(() => {
          this._networkStatsPolling = false;
        });
    };

    pollNetworkStats();
    this._networkStatsTimer = setInterval(pollNetworkStats, NETWORK_STATS_INTERVAL_MS);
  }

  private stopNetworkStatsPolling() {
    if (this._networkStatsTimer) {
      clearInterval(this._networkStatsTimer);
      this._networkStatsTimer = null;
    }

    this._networkStatsPolling = false;
    this._lastVideoBitrateSample = null;
    this._lastVideoFrameSample = null;
    this._lastPacketLossSample = null;
    this._lastInputRoundTripMs = null;
  }

  private buildNetworkStats(statsReport: RTCStatsReport): NetplayNetworkStats {
    const sampledAt = Date.now();
    const performanceSampledAt = performance.now();
    const selectedCandidatePair = this.findSelectedCandidatePair(statsReport);
    const rttMs = selectedCandidatePair
      ? toRoundedMs(
          readNumber(selectedCandidatePair, "currentRoundTripTime") ??
            readNumber(selectedCandidatePair, "roundTripTime"),
        )
      : null;
    const availableOutgoingBitrate = selectedCandidatePair
      ? readNumber(selectedCandidatePair, "availableOutgoingBitrate")
      : null;
    const availableOutgoingBitrateKbps =
      availableOutgoingBitrate === null
        ? null
        : Math.max(0, Math.round(availableOutgoingBitrate / 1000));
    const localCandidateId = selectedCandidatePair
      ? readString(selectedCandidatePair, "localCandidateId")
      : null;
    const remoteCandidateId = selectedCandidatePair
      ? readString(selectedCandidatePair, "remoteCandidateId")
      : null;
    const localCandidateType = this.getCandidateType(statsReport, localCandidateId);
    const remoteCandidateType = this.getCandidateType(statsReport, remoteCandidateId);

    let inboundVideoBytes: number | null = null;
    let outboundVideoBytes: number | null = null;
    let inboundFrameCounter: number | null = null;
    let outboundFrameCounter: number | null = null;
    let directInboundFps: number | null = null;
    let directOutboundFps: number | null = null;
    let inboundFramesDropped: number | null = null;
    let outboundFramesDropped: number | null = null;
    let jitterMs: number | null = null;
    let packetLossSample: PacketLossSample | null = null;
    let fallbackPacketLossPercent: number | null = null;
    let remoteInboundRttMs: number | null = null;

    statsReport.forEach((statsValue) => {
      const stats = asStatsRecord(statsValue);
      const kind = getRtpKind(stats);

      if (kind !== "video") {
        return;
      }

      if (stats.type === "outbound-rtp") {
        outboundVideoBytes = readNumber(stats, "bytesSent") ?? outboundVideoBytes;
        outboundFrameCounter =
          readNumber(stats, "framesEncoded") ??
          readNumber(stats, "framesSent") ??
          outboundFrameCounter;
        directOutboundFps = readNumber(stats, "framesPerSecond") ?? directOutboundFps;
        outboundFramesDropped = readNumber(stats, "framesDropped") ?? outboundFramesDropped;
        return;
      }

      if (stats.type === "inbound-rtp") {
        inboundVideoBytes = readNumber(stats, "bytesReceived") ?? inboundVideoBytes;
        inboundFrameCounter = readNumber(stats, "framesDecoded") ?? inboundFrameCounter;
        directInboundFps = readNumber(stats, "framesPerSecond") ?? directInboundFps;
        inboundFramesDropped = readNumber(stats, "framesDropped") ?? inboundFramesDropped;
        jitterMs = toRoundedMs(readNumber(stats, "jitter")) ?? jitterMs;
      }

      if (stats.type === "inbound-rtp" || stats.type === "remote-inbound-rtp") {
        const nextPacketLossSample = getPacketLossSample(stats);

        if (
          nextPacketLossSample &&
          (!packetLossSample || nextPacketLossSample.packetsTotal > packetLossSample.packetsTotal)
        ) {
          packetLossSample = nextPacketLossSample;
        }

        const fractionLost = readNumber(stats, "fractionLost");
        if (fractionLost !== null) {
          const normalizedLossPercent = fractionLost <= 1 ? fractionLost * 100 : fractionLost;
          fallbackPacketLossPercent = Math.max(
            fallbackPacketLossPercent ?? 0,
            normalizedLossPercent,
          );
        }
      }

      if (stats.type === "remote-inbound-rtp") {
        remoteInboundRttMs = toRoundedMs(readNumber(stats, "roundTripTime")) ?? remoteInboundRttMs;
      }
    });

    const videoDirection: VideoStatsDirection | null =
      outboundVideoBytes !== null ? "outbound" : inboundVideoBytes !== null ? "inbound" : null;
    const videoBytes = videoDirection === "outbound" ? outboundVideoBytes : inboundVideoBytes;
    const videoFrameDirection: VideoStatsDirection | null =
      outboundFrameCounter !== null ? "outbound" : inboundFrameCounter !== null ? "inbound" : null;
    const videoFrameCounter =
      videoFrameDirection === "outbound" ? outboundFrameCounter : inboundFrameCounter;
    const directVideoFps = directOutboundFps ?? directInboundFps;

    const statsDraft: Omit<NetplayNetworkStats, "quality"> = {
      sampledAt,
      rttMs: rttMs ?? remoteInboundRttMs,
      jitterMs,
      packetLossPercent: this.updatePacketLossPercent(packetLossSample, fallbackPacketLossPercent),
      availableOutgoingBitrateKbps,
      videoBitrateKbps:
        videoDirection && videoBytes !== null
          ? this.updateVideoBitrateKbps(videoDirection, videoBytes, performanceSampledAt)
          : null,
      videoFps:
        videoFrameDirection !== null
          ? this.updateVideoFps(
              videoFrameDirection,
              videoFrameCounter,
              directVideoFps,
              performanceSampledAt,
            )
          : directVideoFps === null
            ? null
            : Math.max(0, Math.round(directVideoFps)),
      videoFramesDropped:
        outboundFramesDropped !== null
          ? Math.max(0, Math.round(outboundFramesDropped))
          : inboundFramesDropped === null
            ? null
            : Math.max(0, Math.round(inboundFramesDropped)),
      inputRoundTripMs: this._lastInputRoundTripMs,
      inputSeqGapCount: this._inputSeqGapCount,
      staleInputDropCount: this._staleInputDropCount,
      staleRepairDropCount: this._staleRepairDropCount,
      inputBufferedBytes: this.inputDc?.bufferedAmount ?? 0,
      controlBufferedBytes: this.controlDc?.bufferedAmount ?? 0,
      repairBufferedBytes: this.repairDc?.bufferedAmount ?? 0,
      chatBufferedBytes: this.chatDc?.bufferedAmount ?? 0,
      localCandidateType,
      remoteCandidateType,
    };

    return {
      ...statsDraft,
      quality: computeNetworkQuality(statsDraft),
    };
  }

  private findSelectedCandidatePair(statsReport: RTCStatsReport): StatsRecord | null {
    let selectedCandidatePair: StatsRecord | null = null;

    statsReport.forEach((statsValue) => {
      const stats = asStatsRecord(statsValue);

      if (stats.type === "transport") {
        const selectedCandidatePairId = readString(stats, "selectedCandidatePairId");
        const candidatePair = selectedCandidatePairId
          ? statsReport.get(selectedCandidatePairId)
          : undefined;

        if (candidatePair) {
          selectedCandidatePair = asStatsRecord(candidatePair);
        }
      }

      if (stats.type !== "candidate-pair") {
        return;
      }

      const state = readString(stats, "state");
      const selected = stats.selected === true;
      const nominated = stats.nominated === true && state === "succeeded";

      if (selected || nominated) {
        selectedCandidatePair = stats;
      }
    });

    return selectedCandidatePair;
  }

  private getCandidateType(
    statsReport: RTCStatsReport,
    candidateId: string | null,
  ): NetplayCandidateType {
    if (!candidateId) {
      return "unknown";
    }

    const candidate = statsReport.get(candidateId);

    if (!candidate) {
      return "unknown";
    }

    return normalizeCandidateType(readString(asStatsRecord(candidate), "candidateType"));
  }

  private updateVideoBitrateKbps(direction: VideoStatsDirection, bytes: number, sampledAt: number) {
    const previousSample = this._lastVideoBitrateSample;
    this._lastVideoBitrateSample = { bytes, direction, sampledAt };

    if (!previousSample || previousSample.direction !== direction || bytes < previousSample.bytes) {
      return null;
    }

    const elapsedSeconds = (sampledAt - previousSample.sampledAt) / 1000;

    if (elapsedSeconds <= 0) {
      return null;
    }

    return Math.max(0, Math.round(((bytes - previousSample.bytes) * 8) / elapsedSeconds / 1000));
  }

  private updateVideoFps(
    direction: VideoStatsDirection,
    frameCounter: number | null,
    directFps: number | null,
    sampledAt: number,
  ) {
    if (directFps !== null) {
      return Math.max(0, Math.round(directFps));
    }

    if (frameCounter === null) {
      return null;
    }

    const previousSample = this._lastVideoFrameSample;
    this._lastVideoFrameSample = { direction, frames: frameCounter, sampledAt };

    if (
      !previousSample ||
      previousSample.direction !== direction ||
      frameCounter < previousSample.frames
    ) {
      return null;
    }

    const elapsedSeconds = (sampledAt - previousSample.sampledAt) / 1000;

    if (elapsedSeconds <= 0) {
      return null;
    }

    return Math.max(0, Math.round((frameCounter - previousSample.frames) / elapsedSeconds));
  }

  private updatePacketLossPercent(
    packetLossSample: PacketLossSample | null,
    fallbackPacketLossPercent: number | null,
  ) {
    if (!packetLossSample) {
      return fallbackPacketLossPercent === null
        ? null
        : Math.min(100, Math.max(0, fallbackPacketLossPercent));
    }

    const previousSample = this._lastPacketLossSample;
    this._lastPacketLossSample = packetLossSample;

    if (previousSample && packetLossSample.packetsTotal > previousSample.packetsTotal) {
      const deltaPacketsTotal = packetLossSample.packetsTotal - previousSample.packetsTotal;
      const deltaPacketsLost = Math.max(
        0,
        packetLossSample.packetsLost - previousSample.packetsLost,
      );

      if (deltaPacketsTotal > 0) {
        return Math.min(100, Math.max(0, (deltaPacketsLost / deltaPacketsTotal) * 100));
      }
    }

    return Math.min(
      100,
      Math.max(0, (packetLossSample.packetsLost / packetLossSample.packetsTotal) * 100),
    );
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

    let nextState: GameplayTransportState = "closed";
    if (inputState === "open" && controlState === "open") {
      nextState = "open";
    } else if (inputState === "closing" || controlState === "closing") {
      nextState = "closing";
    } else if (
      inputState === "connecting" ||
      controlState === "connecting" ||
      inputState === "open" ||
      controlState === "open"
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
          if (!Number.isFinite(inp.seq)) {
            return;
          }

          if (inp.seq <= this._remoteAppliedInputSeq) {
            this._staleInputDropCount += 1;
            console.log(
              `[PEER] ignoring stale input seq ${inp.seq} (applied ${this._remoteAppliedInputSeq})`,
            );
            return;
          }

          if (inp.seq !== this._remoteExpectedInputSeq) {
            this._inputSeqGapCount += 1;
            console.warn(
              `[PEER] input seq gap: expected ${this._remoteExpectedInputSeq}, got ${inp.seq}`,
            );
            this.handler.onInputSeqGap?.(this._remoteExpectedInputSeq, inp.seq);
          }

          this._remoteAppliedInputSeq = inp.seq;
          this._remoteExpectedInputSeq = Math.max(this._remoteExpectedInputSeq, inp.seq + 1);
          this.handler.onInput(inp);
          this.sendInputAck(inp);
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
        } else if (msg.type === "start-signal") {
          console.log("[PEER] received start-signal");
          this.handler.onStartSignal?.();
        } else if (msg.type === "heartbeat") {
          this.handler.onHeartbeat?.(msg.ts);
        }
      } catch {
        /* ignore */
      }
    };
  }

  private setupRepairDataChannel(dc: RTCDataChannel) {
    this.repairDc = dc;

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
        const msg = JSON.parse(e.data) as InputSyncMessage | InputAckMessage;

        if (msg.type === "input-ack") {
          if (Number.isFinite(msg.sentAt)) {
            this._lastInputRoundTripMs = Math.max(0, Math.round(performance.now() - msg.sentAt));
          }
          return;
        }

        if (msg.type !== "input-sync") return;
        if (!Number.isFinite(msg.seq)) {
          return;
        }

        if (msg.seq <= this._remoteAppliedInputSeq) {
          this._staleRepairDropCount += 1;
          return;
        }

        this._remoteAppliedInputSeq = msg.seq;
        this._remoteExpectedInputSeq = Math.max(this._remoteExpectedInputSeq, msg.seq + 1);
        this.handler.onRemoteHeldMask?.(msg.heldMask);
      } catch {
        /* ignore */
      }
    };
  }

  private sendInputAck(input: InputMessage) {
    if (this.repairDc?.readyState !== "open") return;
    if (!Number.isFinite(input.sentAt)) return;

    const message: InputAckMessage = {
      type: "input-ack",
      seq: input.seq,
      sentAt: input.sentAt,
    };

    this.repairDc.send(JSON.stringify(message));
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
      const repairDc = pc.createDataChannel(REPAIR_CHANNEL_LABEL, {
        ordered: false,
        maxRetransmits: 0,
      });
      const chatDc = pc.createDataChannel(CHAT_CHANNEL_LABEL);
      this.setupInputDataChannel(inputDc);
      this.setupControlDataChannel(controlDc);
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
        const encoding = params.encodings[0] as RTCRtpEncodingParameters & {
          networkPriority?: "high";
          priority?: "high";
        };
        encoding.maxBitrate = VIDEO_STREAM_MAX_BITRATE;
        encoding.maxFramerate = VIDEO_STREAM_MAX_FRAMERATE;
        encoding.scaleResolutionDownBy = VIDEO_STREAM_SCALE_DOWN;
        encoding.priority = "high";
        encoding.networkPriority = "high";
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

  private resetRemoteInputDiagnostics() {
    this._remoteExpectedInputSeq = 1;
    this._remoteAppliedInputSeq = 0;
    this._inputSeqGapCount = 0;
    this._staleInputDropCount = 0;
    this._staleRepairDropCount = 0;
  }
}

function updateHeldMask(mask: number, button: number, down: boolean) {
  if (button < 0 || button > 30) return mask;
  const bit = 1 << button;
  return down ? mask | bit : mask & ~bit;
}
