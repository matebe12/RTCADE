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
  startPeriodicResync: () => void;
  onHostGameStarted?: () => void;
  onStartVideoCapture?: () => void;
}

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
  startPeriodicResync,
  onHostGameStarted,
  onStartVideoCapture,
}: UseNetplayInitialSyncOptions) {
  const localReadyRef = useRef(false);
  const remoteReadyRef = useRef(false);
  const pendingStateRef = useRef<ArrayBuffer | null>(null);
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
            console.log("[LOBBY] HOST start gate opened without replaying emulator");
          } else {
            emulatorRuntime.sync.startGame();
          }

          // Mark game running so EmulatorPlayer's keyboard handler processes input
          (window as unknown as Record<string, unknown>).__rtcade_game_running = true;
          if (notifyPeer) {
            peerRef.current?.sendStartSignal();
          }
          // HOST: start video capture for streaming after game starts
          if (currentRole === "host") {
            onHostGameStarted?.();
            onStartVideoCapture?.();
          }
        } catch (error) {
          console.error("[LOBBY] startGame failed:", error);
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

  // Video streaming: GUEST auto-marks ready when DC opens (no emulator to wait for)
  useEffect(() => {
    if (
      dcState === "open" &&
      !localReadyRef.current &&
      roleRef.current === "guest" &&
      !gameStarted
    ) {
      console.log("[LOBBY] GUEST auto-ready (video streaming mode, no emulator)");
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
    pendingStateRef.current = null;
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
      // Video streaming: start the game directly — no state transfer needed
      updateSync(NETPLAY_COPY.syncPreparing);
      startGame(NETPLAY_COPY.syncStartNow, true);
      startPeriodicResync();
    }
  }, [roleRef, startGame, startPeriodicResync, updateSync]);

  const handlePeerSaveState = useCallback(
    (stateBuffer: ArrayBuffer) => {
      console.log(
        "[LOBBY] onSaveState, role:",
        roleRef.current,
        "size:",
        stateBuffer.byteLength,
        "localReady:",
        localReadyRef.current,
      );
      if (roleRef.current === "guest") {
        if (localReadyRef.current) {
          updateSync(NETPLAY_COPY.syncFinishingSetup);
          emulatorRuntime.sync.loadSaveState(stateBuffer);
        } else {
          pendingStateRef.current = stateBuffer;
          updateSync(NETPLAY_COPY.syncStateReceived);
        }
      }
    },
    [emulatorRuntime, roleRef, updateSync],
  );

  const handlePeerStateLoaded = useCallback(() => {
    if (roleRef.current === "host") {
      console.log("[LOBBY] HOST: GUEST state loaded, starting both!");
      startGame(NETPLAY_COPY.syncStartNow, true);
      startPeriodicResync();
    }
  }, [roleRef, startGame, startPeriodicResync]);

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
        // Video streaming: start game directly — no state transfer needed
        updateSync(NETPLAY_COPY.syncPreparing);
        startGame(NETPLAY_COPY.syncStartNow, true);
        startPeriodicResync();
      }
    } else {
      updateSync(NETPLAY_COPY.syncWaitingForStart);
      peerRef.current?.sendPeerReady();
      if (pendingStateRef.current) {
        updateSync(NETPLAY_COPY.syncFinishingSetup);
        emulatorRuntime.sync.loadSaveState(pendingStateRef.current);
        pendingStateRef.current = null;
      }
    }
  }, [emulatorRuntime, peerRef, roleRef, startGame, startPeriodicResync, updateSync]);

  const handleSaveState = useCallback(
    (stateBuffer: ArrayBuffer) => {
      if (roleRef.current === "host") {
        updateSync(NETPLAY_COPY.syncPreparing);
        const sent = peerRef.current?.sendSaveState(stateBuffer);
        if (!sent) {
          console.error("[SYNC] sendSaveState failed (backpressure or DC not ready)");
          updateSync("전송 실패 - 재시도 중...");
          // Retry after brief delay
          setTimeout(() => {
            const retry = peerRef.current?.sendSaveState(stateBuffer);
            if (retry) updateSync(NETPLAY_COPY.syncPreparing);
          }, 100);
        }
      }
    },
    [peerRef, roleRef, updateSync],
  );

  const handleStateLoaded = useCallback(() => {
    console.log("[LOBBY] handleStateLoaded, role:", roleRef.current);
    if (roleRef.current === "guest" && !gameStartedRef.current) {
      updateSync(NETPLAY_COPY.syncReadyToStart);
      peerRef.current?.sendStateLoaded();
    }
  }, [gameStartedRef, peerRef, roleRef, updateSync]);

  const handleSaveStateError = useCallback(
    (error: string) => {
      console.warn("[NETPLAY] Save state error:", error);
      updateSync(NETPLAY_COPY.syncFallbackStart);
      if (roleRef.current === "host") {
        setTimeout(() => {
          if (!gameStartedRef.current) {
            console.log("[LOBBY] HOST: fallback start (no state sync)");
            startGame(NETPLAY_COPY.syncStartNow, true);
          }
        }, 500);
      }
    },
    [gameStartedRef, roleRef, startGame, updateSync],
  );

  return {
    handleEmulatorReady,
    handlePeerReady,
    handlePeerSaveState,
    handlePeerStartSignal,
    handlePeerStateLoaded,
    handleSaveState,
    handleSaveStateError,
    handleStateLoaded,
    resetInitialSyncRuntime,
  };
}
