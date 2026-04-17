import { useCallback, useEffect, useRef, type MutableRefObject, type RefObject } from "react";

import { loadSaveState, requestSaveState, sendStartGame } from "@/components/EmulatorPlayer";
import { NETPLAY_COPY } from "@/netplay/netplayCopy";
import type { NetplayPeer } from "@/netplay/peer";

interface UseNetplayInitialSyncOptions {
  dcState: string;
  gameStarted: boolean;
  peerRef: MutableRefObject<NetplayPeer | null>;
  emulatorRef: RefObject<HTMLIFrameElement | null>;
  roleRef: MutableRefObject<"host" | "guest" | null>;
  gameStartedRef: MutableRefObject<boolean>;
  setGameStarted: (gameStarted: boolean) => void;
  updateSync: (message: string) => void;
  markSessionStarted: () => void;
  startPeriodicResync: () => void;
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
}: UseNetplayInitialSyncOptions) {
  const localReadyRef = useRef(false);
  const remoteReadyRef = useRef(false);
  const pendingStateRef = useRef<ArrayBuffer | null>(null);

  const startGame = useCallback(
    (message: string, notifyPeer: boolean) => {
      updateSync(message);
      markSessionStarted();
      setGameStarted(true);
      gameStartedRef.current = true;
      sendStartGame(emulatorRef);
      if (notifyPeer) {
        peerRef.current?.sendStartSignal();
      }
    },
    [emulatorRef, gameStartedRef, markSessionStarted, peerRef, setGameStarted, updateSync],
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

  const resetInitialSyncRuntime = useCallback(() => {
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
      updateSync(NETPLAY_COPY.syncPreparing);
      requestSaveState(emulatorRef);
    }
  }, [emulatorRef, roleRef, updateSync]);

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
          loadSaveState(emulatorRef, stateBuffer);
        } else {
          pendingStateRef.current = stateBuffer;
          updateSync(NETPLAY_COPY.syncStateReceived);
        }
      }
    },
    [emulatorRef, roleRef, updateSync],
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
        updateSync(NETPLAY_COPY.syncPreparing);
        requestSaveState(emulatorRef);
      }
    } else {
      updateSync(NETPLAY_COPY.syncWaitingForStart);
      peerRef.current?.sendPeerReady();
      if (pendingStateRef.current) {
        updateSync(NETPLAY_COPY.syncFinishingSetup);
        loadSaveState(emulatorRef, pendingStateRef.current);
        pendingStateRef.current = null;
      }
    }
  }, [emulatorRef, peerRef, roleRef, updateSync]);

  const handleSaveState = useCallback(
    (stateBuffer: ArrayBuffer) => {
      if (roleRef.current === "host") {
        updateSync(NETPLAY_COPY.syncPreparing);
        peerRef.current?.sendSaveState(stateBuffer);
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
