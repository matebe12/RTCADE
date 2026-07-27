/**
 * useGGPOSession — GGPO 넷플레이 세션 관리 훅
 *
 * GGPOEngine + ArcadeWrapper + GGPONetplayPeer를 조합하여
 * 전체 GGPO 넷플레이 세션을 관리하는 React 훅.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { IArcade } from "@rtcade/emulator";
import { GGPOEngine } from "./ggpo/GGPOEngine";
import { GGPONetplayPeer, type GGPOPeerEventHandlers } from "./GGPONetplayPeer";
import type {
  GGPOEngineConfig,
  GGPOEventHandlers,
  GGPOSessionStats,
  GGPOSessionState,
  GGPOPlayerRole,
} from "./types";
import { DEFAULT_GGPO_CONFIG } from "./types";

export interface UseGGPOSessionOptions {
  arcade: IArcade | null;
  config?: Partial<GGPOEngineConfig>;
  signalingUrl: string;
}

export interface UseGGPOSessionReturn {
  // 세션 상태
  state: GGPOSessionState;
  role: GGPOPlayerRole | null;
  roomCode: string | null;

  // 방 관리
  createRoom: (romFilename: string, core: string, nickname?: string) => void;
  joinRoom: (code: string, nickname?: string) => void;
  startSession: () => void;

  // 게임
  localInputMask: number;
  setLocalInputMask: (mask: number) => void;

  // 통계
  stats: GGPOSessionStats | null;

  // 세션 종료
  leaveSession: () => void;
}

export function useGGPOSession({
  arcade,
  config,
  signalingUrl,
}: UseGGPOSessionOptions): UseGGPOSessionReturn {
  const [state, setState] = useState<GGPOSessionState>("idle");
  const [role, setRole] = useState<GGPOPlayerRole | null>(null);
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [localInputMask, setLocalInputMask] = useState(0);
  const [stats, setStats] = useState<GGPOSessionStats | null>(null);

  const engineRef = useRef<GGPOEngine | null>(null);
  const peerRef = useRef<GGPONetplayPeer | null>(null);
  const rafRef = useRef<number | null>(null);
  const localMaskRef = useRef(0);
  const startedRef = useRef(false);

  // ───── GGPO 엔진 초기화 ─────
  useEffect(() => {
    if (!arcade) return;

    const ggpoConfig = { ...DEFAULT_GGPO_CONFIG, ...config };

    const eventHandlers: GGPOEventHandlers = {
      onSendInput: (frameNum, mask) => {
        peerRef.current?.sendInput(frameNum, mask);
      },
      onStats: (newStats) => {
        setStats(newStats);
      },
      onFrame: () => {
        // 렌더링은 외부에서 처리
      },
      onRollback: (from, to) => {
        console.log(`[GGPO] rollback: ${from} → ${to}`);
      },
      onDesync: (frameNum) => {
        console.warn(`[GGPO] desync detected at frame ${frameNum}`);
      },
    };

    const engine = new GGPOEngine(ggpoConfig, eventHandlers);
    engine.init(arcade, 0); // 기본 1P
    engineRef.current = engine;

    return () => {
      engine.destroy();
      engineRef.current = null;
    };
  }, [arcade, config]);

  // ───── WebRTC 피어 초기화 ─────
  useEffect(() => {
    const peerHandlers: GGPOPeerEventHandlers = {
      onConnected: () => {
        console.log("[GGPO Session] peer connected");
        setState("syncing");
      },
      onDisconnected: () => {
        console.log("[GGPO Session] peer disconnected");
        setState("disconnected");
      },
      onInput: (msg) => {
        engineRef.current?.addRemoteInput(msg.frameNum, msg.inputMask);
      },
      onControl: (msg) => {
        switch (msg.type) {
          case "peer-ready":
            // GUEST가 준비되면 HOST가 시작
            if (role === "host" && !startedRef.current) {
              peerRef.current?.sendControl({ type: "start-signal" });
              startGameLoop();
            }
            break;
          case "start-signal":
            // GUEST: 게임 시작
            if (role === "guest" && !startedRef.current) {
              startGameLoop();
            }
            break;
          case "heartbeat":
            // keepalive
            break;
        }
      },
      onRoomCreated: (code) => {
        setRoomCode(code);
        setRole("host");
        setState("loading");
      },
      onRoomJoined: (info) => {
        setRoomCode(info.code);
        setRole("guest");
        setState("loading");
      },
      onGuestJoined: () => {
        // GUEST가 입장하면 HOST가 세션 시작
        // (실제로는 ROM 로딩 완료 후에 시작)
      },
      onError: (msg) => {
        console.error("[GGPO Session] error:", msg);
      },
    };

    const peer = new GGPONetplayPeer(peerHandlers);
    peerRef.current = peer;

    // 시그널링 서버 연결
    peer.connect(signalingUrl).catch((err) => {
      console.error("[GGPO Session] signaling connect failed:", err);
    });

    return () => {
      peer.close();
      peerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signalingUrl]);

  // ───── 게임 루프 ─────
  const startGameLoop = useCallback(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    const engine = engineRef.current;
    if (!engine) return;

    engine.start();
    setState("playing");

    const loop = () => {
      if (!startedRef.current) return;
      engine.tick(localMaskRef.current);
      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
  }, []);

  const stopGameLoop = useCallback(() => {
    startedRef.current = false;
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    engineRef.current?.stop();
  }, []);

  // ───── Public API ─────
  const createRoom = useCallback(
    (romFilename: string, core: string, nickname?: string) => {
      peerRef.current?.createRoom(romFilename, core, nickname);
    },
    [],
  );

  const joinRoom = useCallback((code: string, nickname?: string) => {
    peerRef.current?.joinRoom(code, nickname);
  }, []);

  const startSession = useCallback(() => {
    if (role === "host") {
      peerRef.current?.markSessionStarted();
      // GUEST의 peer-ready를 기다린 후 게임 루프 시작
    } else if (role === "guest") {
      peerRef.current?.sendControl({ type: "peer-ready" });
      // HOST의 start-signal을 기다린 후 게임 루프 시작
    }
  }, [role]);

  const wrappedSetLocalInputMask = useCallback((mask: number) => {
    localMaskRef.current = mask;
    setLocalInputMask(mask);
  }, []);

  const leaveSession = useCallback(() => {
    stopGameLoop();
    peerRef.current?.close();
    setState("idle");
    setRole(null);
    setRoomCode(null);
  }, [stopGameLoop]);

  return {
    state,
    role,
    roomCode,
    createRoom,
    joinRoom,
    startSession,
    localInputMask,
    setLocalInputMask: wrappedSetLocalInputMask,
    stats,
    leaveSession,
  };
}