import { SignalingClient, type SignalingMessage } from "./signaling";

export type InputMessage = {
  type: "input";
  button: number;
  down: boolean;
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
  onResyncFailed?: () => void; // Resync failed
  // Input sequence gap detection
  onInputSeqGap?: (expected: number, got: number) => void;
};

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }, { urls: "stun:stun1.l.google.com:19302" }],
};

export class NetplayPeer {
  private signaling: SignalingClient;
  private pc: RTCPeerConnection | null = null;
  private dc: RTCDataChannel | null = null;
  private handler: PeerEventHandler;
  private _closing = false;

  constructor(handler: PeerEventHandler) {
    this.handler = handler;
    this.signaling = new SignalingClient(this.onSignaling);
  }

  async connect(serverUrl: string) {
    await this.signaling.connect(serverUrl);
  }

  createRoom(romFilename: string, core: string, bios?: string, nickname?: string, avatar?: string) {
    this.signaling.send({ type: "create-room", romFilename, core, bios, nickname, avatar });
  }

  joinRoom(code: string, nickname?: string, avatar?: string) {
    this.signaling.send({ type: "join-room", code, nickname, avatar });
  }

  private _inputSeq = 0;

  sendInput(button: number, down: boolean) {
    if (this.dc?.readyState === "open") {
      this.dc.send(JSON.stringify({ type: "input", button, down, seq: ++this._inputSeq }));
    }
  }

  sendPeerReady() {
    console.log("[PEER] sendPeerReady, dc:", this.dc?.readyState);
    if (this.dc?.readyState === "open") {
      this.dc.send(JSON.stringify({ type: "peer-ready" }));
    }
  }

  // Send save state as chunked binary over DataChannel
  sendSaveState(state: ArrayBuffer) {
    if (this.dc?.readyState !== "open") {
      console.warn("[PEER] sendSaveState: DC not open");
      return;
    }
    const CHUNK = 64 * 1024; // 64KB chunks
    const total = state.byteLength;
    const numChunks = Math.ceil(total / CHUNK);
    console.log(`[PEER] sendSaveState: ${total} bytes, ${numChunks} chunks`);
    // Send header first
    this.dc.send(
      JSON.stringify({ type: "save-state-header", totalBytes: total, chunks: numChunks }),
    );
    // Send binary chunks
    for (let i = 0; i < numChunks; i++) {
      const start = i * CHUNK;
      const end = Math.min(start + CHUNK, total);
      this.dc.send(state.slice(start, end));
    }
    console.log("[PEER] sendSaveState: all chunks sent");
  }

  // Tell HOST that GUEST loaded the state
  sendStateLoaded() {
    console.log("[PEER] sendStateLoaded");
    if (this.dc?.readyState === "open") {
      this.dc.send(JSON.stringify({ type: "state-loaded" }));
    }
  }

  // HOST tells GUEST to start the game
  sendStartSignal() {
    console.log("[PEER] sendStartSignal");
    if (this.dc?.readyState === "open") {
      this.dc.send(JSON.stringify({ type: "start-signal" }));
    }
  }

  // --- Fire-and-forget resync ---
  /** Reset remote input sequence counter (after resync, GUEST resets) */
  resetRemoteSeq() {
    // Will be set when setupDataChannel runs; this method signals
    // the DC handler to accept next seq as the new baseline
    this._resetSeqFlag = true;
  }
  private _resetSeqFlag = false;

  sendResyncState(state: ArrayBuffer) {
    if (this.dc?.readyState !== "open") return;
    const CHUNK = 256 * 1024; // 256KB chunks
    const total = state.byteLength;
    const numChunks = Math.ceil(total / CHUNK);
    this.dc.send(
      JSON.stringify({ type: "resync-state-header", totalBytes: total, chunks: numChunks }),
    );
    for (let i = 0; i < numChunks; i++) {
      const start = i * CHUNK;
      const end = Math.min(start + CHUNK, total);
      this.dc.send(state.slice(start, end));
    }
  }

  close() {
    this._closing = true;
    this.dc?.close();
    this.pc?.close();
    this.signaling.close();
    this.dc = null;
    this.pc = null;
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
        if (!this._closing) this.handler.onDisconnected();
      }
    };
  }

  private setupDataChannel(dc: RTCDataChannel) {
    this.dc = dc;
    dc.binaryType = "arraybuffer";
    this.handler.onDataChannelState?.(dc.readyState);

    // State for receiving chunked save state
    let pendingState: {
      totalBytes: number;
      chunks: number;
      received: ArrayBuffer[];
      bytesReceived: number;
    } | null = null;

    // State for receiving chunked resync state (separate stream)
    let pendingResync: {
      totalBytes: number;
      chunks: number;
      received: ArrayBuffer[];
      bytesReceived: number;
    } | null = null;

    // Input sequence tracking for gap detection
    let expectedSeq = 1;

    dc.onopen = () => {
      this.handler.onDataChannelState?.("open");
      this.handler.onConnected();
    };
    dc.onclose = () => {
      this.handler.onDataChannelState?.("closed");
      if (!this._closing) this.handler.onDisconnected();
    };
    dc.onmessage = (e) => {
      // Binary data = save state chunk (initial or resync)
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
            pendingResync = null;
            this.handler.onResyncState?.(full.buffer);
          }
          return;
        }
        if (pendingState) {
          pendingState.received.push(e.data);
          pendingState.bytesReceived += e.data.byteLength;
          if (pendingState.received.length >= pendingState.chunks) {
            // Reassemble
            const full = new Uint8Array(pendingState.totalBytes);
            let offset = 0;
            for (const chunk of pendingState.received) {
              full.set(new Uint8Array(chunk), offset);
              offset += chunk.byteLength;
            }
            pendingState = null;
            this.handler.onSaveState?.(full.buffer);
          }
        }
        return;
      }
      // JSON messages
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
        } else if (msg.type === "save-state-header") {
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
          };
        } else if (msg.type === "resync-failed") {
          this.handler.onResyncFailed?.();
        }
      } catch {
        /* ignore */
      }
    };
  }

  private async startAsHost() {
    this.setupPeerConnection();
    const dc = this.pc!.createDataChannel("input");
    this.setupDataChannel(dc);

    const offer = await this.pc!.createOffer();
    await this.pc!.setLocalDescription(offer);
    this.signaling.send({ type: "offer", sdp: this.pc!.localDescription! });
  }

  private async handleOffer(sdp: RTCSessionDescriptionInit) {
    this.setupPeerConnection();

    this.pc!.ondatachannel = (e) => {
      this.setupDataChannel(e.channel);
    };

    await this.pc!.setRemoteDescription(sdp);
    const answer = await this.pc!.createAnswer();
    await this.pc!.setLocalDescription(answer);
    this.signaling.send({ type: "answer", sdp: this.pc!.localDescription! });
  }
}
