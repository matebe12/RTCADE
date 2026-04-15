export type SignalingMessage =
  | {
      type: "create-room";
      romFilename: string;
      core: string;
      bios?: string;
      nickname?: string;
      avatar?: string;
    }
  | { type: "join-room"; code: string; nickname?: string; avatar?: string }
  | { type: "room-created"; code: string }
  | {
      type: "room-joined";
      code: string;
      romFilename: string;
      core: string;
      bios?: string;
      hostNickname?: string;
      hostAvatar?: string;
    }
  | { type: "guest-joined"; guestNickname?: string; guestAvatar?: string }
  | { type: "peer-disconnected" }
  | { type: "error"; message: string }
  | { type: "offer"; sdp: RTCSessionDescriptionInit }
  | { type: "answer"; sdp: RTCSessionDescriptionInit }
  | { type: "ice-candidate"; candidate: RTCIceCandidateInit };

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
