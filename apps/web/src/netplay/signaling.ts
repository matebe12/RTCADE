/** 대기실 코드별 시그널링 스냅샷에서 한 참가자 정보. */
export interface RoomLobbyParticipant {
  id: string;
  role: "host" | "guest" | "spectator";
  nickname?: string;
  avatar?: string;
  ready: boolean;
  joinedAt: number;
}

/** `room-lobby-updated` 메시지 타입. 대기실 상태 변화 시 서버가 전송한다. */
export interface RoomLobbySnapshotMessage {
  type: "room-lobby-updated";
  code: string;
  roomState: "waiting" | "playing";
  romFilename: string;
  romPath: string;
  core: string;
  bios?: string;
  isPublic: boolean;
  participants: RoomLobbyParticipant[];
  canStart: boolean;
  hasGuest: boolean;
  spectatorSlotsRemaining: number;
  roleLocked: boolean;
}

/** `room-session-started` 메시지 타입. 변방에서 세션이 시작되면 모든 참가자에게 전달된다. */
export interface RoomSessionStartedMessage {
  type: "room-session-started";
  code: string;
  role: "host" | "guest" | "spectator";
  romFilename: string;
  romPath: string;
  core: string;
  bios?: string;
  hostNickname?: string;
  hostAvatar?: string;
}

/**
 * 클라이언트 ↔ 서버 간 오가는 모든 WebSocket 시그널링 메시지의 유니온 타입.
 * 방 생성/입장/관전, RTC offer/answer/ice-candidate 등을 포함한다.
 */
export type SignalingMessage =
  | {
      type: "create-room";
      romFilename: string;
      core: string;
      bios?: string;
      isPublic?: boolean;
      nickname?: string;
      avatar?: string;
    }
  | { type: "join-room"; code: string; nickname?: string; avatar?: string }
  | { type: "spectate-room"; code: string; nickname?: string; avatar?: string }
  | { type: "set-room-ready"; ready: boolean }
  | { type: "update-room-game"; romPath: string; core: string; bios?: string }
  | { type: "kick-room-participant"; participantId: string }
  | { type: "session-started" }
  | { type: "room-created"; code: string }
  | {
      type: "room-joined";
      code: string;
      participantId: string;
      role: "guest" | "spectator";
      romFilename: string;
      romPath: string;
      core: string;
      bios?: string;
      hostNickname?: string;
      hostAvatar?: string;
    }
  | { type: "guest-joined"; guestNickname?: string; guestAvatar?: string }
  | {
      type: "spectator-joined";
      spectatorId: string;
      spectatorNickname?: string;
      spectatorAvatar?: string;
      spectatorCount: number;
    }
  | {
      type: "spectator-disconnected";
      spectatorId: string;
      spectatorCount: number;
    }
  | { type: "room-kicked"; message: string }
  | RoomLobbySnapshotMessage
  | RoomSessionStartedMessage
  | { type: "peer-disconnected" }
  | { type: "error"; message: string }
  | { type: "offer"; sdp: RTCSessionDescriptionInit; spectatorId?: string }
  | { type: "answer"; sdp: RTCSessionDescriptionInit; spectatorId?: string }
  | { type: "ice-candidate"; candidate: RTCIceCandidateInit; spectatorId?: string };

/** WebSocket 시그널링 메시지를 처리하는 콜백 함수 타입. */
export type SignalingHandler = (msg: SignalingMessage) => void;

/**
 * WebSocket 기반 시그널링 클라이언트.
 * 서버와 WebSocket을 연결하고 메시지를 수신/송신한다.
 */
export class SignalingClient {
  private ws: WebSocket | null = null;
  private handler: SignalingHandler;

  constructor(handler: SignalingHandler) {
    this.handler = handler;
  }

  /**
   * WebSocket 서버에 연결한다.
   * @param url - WebSocket URL
   */
  connect(url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(url);
      this.ws.onopen = () => resolve();
      this.ws.onerror = () => reject(new Error("WebSocket 연결 실패"));
      this.ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data) as SignalingMessage;
          this.handler(msg);
        } catch {
          /* ignore */
        }
      };
      this.ws.onclose = () => {
        this.ws = null;
      };
    });
  }

  /**
   * 메시지를 서버로 전송한다.
   * @param msg - 전송할 {@link SignalingMessage}
   */
  send(msg: SignalingMessage) {
    this.ws?.send(JSON.stringify(msg));
  }

  /** WebSocket 연결을 닫고 정리한다. */
  close() {
    this.ws?.close();
    this.ws = null;
  }
}
