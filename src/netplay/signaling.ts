export interface RoomLobbyParticipant {
  id: string;
  role: "host" | "guest" | "spectator";
  nickname?: string;
  avatar?: string;
  ready: boolean;
  joinedAt: number;
}

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

export type SignalingHandler = (msg: SignalingMessage) => void;

export class SignalingClient {
  private ws: WebSocket | null = null;
  private handler: SignalingHandler;

  constructor(handler: SignalingHandler) {
    this.handler = handler;
  }

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

  send(msg: SignalingMessage) {
    this.ws?.send(JSON.stringify(msg));
  }

  close() {
    this.ws?.close();
    this.ws = null;
  }
}
