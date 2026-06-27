import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  type MutableRefObject,
  type RefObject,
} from "react";

import { createEmulatorRuntimeBridge } from "@/lib/emulator-runtime-bridge";
import { NETPLAY_COPY } from "@/netplay/netplayCopy";
import type { NetplayPeer } from "@/netplay/peer";
import type { NetplaySessionRole } from "../../shared/emulator-protocol";

/** {@link useNetplayInitialSync} hook 옵션 인터페이스. */
interface UseNetplayInitialSyncOptions {
  dcState: string;
  gameStarted: boolean;
  peerRef: MutableRefObject<NetplayPeer | null>;
  emulatorRef: RefObject<HTMLDivElement | null>;
  roleRef: MutableRefObject<NetplaySessionRole | null>;
  gameStartedRef: MutableRefObject<boolean>;
  setGameStarted: (gameStarted: boolean) => void;
  updateSync: (message: string) => void;
  markSessionStarted: () => void;
  onHostGameStarted?: () => void;
  onStartVideoCapture?: () => void;
}

/**
 * HOST/GUEST 게임 시작 동기화를 담당하는 hook.
 *
 * 흐름 (video streaming 모드):
 * 1. GUEST: DataChannel이 열리면 자동으로 `peer-ready`를 전송
 * 2. HOST: 에뮬레이터 준비 완료 & GUEST peer-ready 수신 → 게임 시작 + `start-signal` 전송
 * 3. GUEST: `start-signal` 수신 → 에뮬레이터 시작
 */
export function useNetplayInitialSync({
  dcState,
  gameStarted,
  peerRef,
  emulatorRef,
  roleRef,
  gameStartedRef,
  setGameStarted,
  updateSync,
  markSessionStarted,
  onHostGameStarted,
  onStartVideoCapture,
}: UseNetplayInitialSyncOptions) {
  const localReadyRef = useRef(false);
  const remoteReadyRef = useRef(false);
  const startGameTimerRef = useRef<number | null>(null);
  const emulatorRuntime = useMemo(() => createEmulatorRuntimeBridge(emulatorRef), [emulatorRef]);

  const startGame = useCallback(
    (message: string, notifyPeer: boolean) => {
      if (gameStartedRef.current) {
        console.warn("[LOBBY] startGame ignored: session already started");
        return;
      }

      gameStartedRef.current = true;
      updateSync(message);
      markSessionStarted();
      setGameStarted(true);

      startGameTimerRef.current = window.setTimeout(() => {
        startGameTimerRef.current = null;

        try {
          const currentRole = roleRef.current;

          if (currentRole === "host") {
            console.log("[LOBBY] HOST 게임 시작 (에뮬레이터 재실행 없음)");
          } else {
            emulatorRuntime.sync.startGame();
          }

          // 키보드 핸들러가 입력을 처리할 수 있도록 글로벌 플래그 설정
          (window as unknown as Record<string, unknown>).__rtcade_game_running = true;
          if (notifyPeer) {
            peerRef.current?.sendStartSignal();
          }
          // HOST: 게임 시작 후 비디오 커처 시작
          if (currentRole === "host") {
            onHostGameStarted?.();
            onStartVideoCapture?.();
          }
        } catch (error) {
          console.error("[LOBBY] startGame 실패:", error);
          gameStartedRef.current = false;
          setGameStarted(false);
          updateSync(NETPLAY_COPY.syncFallbackStart);
        }
      }, 0);
    },
    [
      emulatorRuntime,
      gameStartedRef,
      markSessionStarted,
      onHostGameStarted,
      onStartVideoCapture,
      peerRef,
      roleRef,
      setGameStarted,
      updateSync,
    ],
  );

  useEffect(() => {
    if (
      dcState === "open" &&
      localReadyRef.current &&
      roleRef.current === "guest" &&
      !gameStarted
    ) {
      peerRef.current?.sendPeerReady();
    }
  }, [dcState, gameStarted, peerRef, roleRef]);

  // 비디오 스트리밍 모드: GUEST는 DC가 열리면 에뮬레이터 없이 자동으로 준비 완료
  useEffect(() => {
    if (
      dcState === "open" &&
      !localReadyRef.current &&
      roleRef.current === "guest" &&
      !gameStarted
    ) {
      console.log("[LOBBY] GUEST 자동 준비 (video streaming 모드)");
      localReadyRef.current = true;
      updateSync(NETPLAY_COPY.syncWaitingForStart);
      peerRef.current?.sendPeerReady();
    }
  }, [dcState, gameStarted, peerRef, roleRef, updateSync]);

  const resetInitialSyncRuntime = useCallback(() => {
    if (startGameTimerRef.current !== null) {
      window.clearTimeout(startGameTimerRef.current);
      startGameTimerRef.current = null;
    }

    localReadyRef.current = false;
    remoteReadyRef.current = false;
    gameStartedRef.current = false;
  }, [gameStartedRef]);

  const handlePeerReady = useCallback(() => {
    console.log(
      "[LOBBY] onPeerReady, role:",
      roleRef.current,
      "localReady:",
      localReadyRef.current,
    );
    remoteReadyRef.current = true;
    if (roleRef.current === "host" && localReadyRef.current) {
      // 비디오 스트리밍: 상태 전송 없이 바로 게임 시작
      updateSync(NETPLAY_COPY.syncPreparing);
      startGame(NETPLAY_COPY.syncStartNow, true);
    }
  }, [roleRef, startGame, updateSync]);

  const handlePeerStartSignal = useCallback(() => {
    if (roleRef.current === "guest" && !gameStartedRef.current) {
      console.log("[LOBBY] GUEST: received start signal from HOST!");
      startGame(NETPLAY_COPY.syncStartNow, false);
    }
  }, [gameStartedRef, roleRef, startGame]);

  const handleEmulatorReady = useCallback(() => {
    localReadyRef.current = true;
    console.log(
      "[LOBBY] handleEmulatorReady, role:",
      roleRef.current,
      "remoteReady:",
      remoteReadyRef.current,
    );

    if (roleRef.current === "host") {
      updateSync(NETPLAY_COPY.syncWaitingForOpponent);
      if (remoteReadyRef.current) {
        // 비디오 스트리밍: 상태 전송 없이 바로 게임 시작
        updateSync(NETPLAY_COPY.syncPreparing);
        startGame(NETPLAY_COPY.syncStartNow, true);
      }
    } else {
      updateSync(NETPLAY_COPY.syncWaitingForStart);
      peerRef.current?.sendPeerReady();
    }
  }, [peerRef, roleRef, startGame, updateSync]);

  return {
    handleEmulatorReady,
    handlePeerReady,
    handlePeerStartSignal,
    resetInitialSyncRuntime,
  };
}
