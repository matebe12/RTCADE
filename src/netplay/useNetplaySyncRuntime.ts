import { useCallback, useRef, type MutableRefObject, type RefObject } from "react";

import type { NetplayPeer } from "@/netplay/peer";
import { useNetplayInitialSync } from "@/netplay/useNetplayInitialSync";
import { useNetplayResyncLoop } from "@/netplay/useNetplayResyncLoop";

interface UseNetplaySyncRuntimeOptions {
  dcState: string;
  gameStarted: boolean;
  peerRef: MutableRefObject<NetplayPeer | null>;
  emulatorRef: RefObject<HTMLIFrameElement | null>;
  roleRef: MutableRefObject<"host" | "guest" | null>;
  setGameStarted: (gameStarted: boolean) => void;
  updateSync: (message: string) => void;
  markSessionStarted: () => void;
}

export function useNetplaySyncRuntime({
  dcState,
  gameStarted,
  peerRef,
  emulatorRef,
  roleRef,
  setGameStarted,
  updateSync,
  markSessionStarted,
}: UseNetplaySyncRuntimeOptions) {
  const gameStartedRef = useRef(false);
  const {
    handlePeerResyncFailed,
    handlePeerResyncState,
    handleResyncFailed,
    handleResyncLoaded,
    handleResyncState,
    resetResyncRuntime,
    startPeriodicResync,
  } = useNetplayResyncLoop({
    peerRef,
    emulatorRef,
    roleRef,
    gameStartedRef,
  });

  const {
    handleEmulatorReady,
    handlePeerReady,
    handlePeerSaveState,
    handlePeerStartSignal,
    handlePeerStateLoaded,
    handleSaveState,
    handleSaveStateError,
    handleStateLoaded,
    resetInitialSyncRuntime,
  } = useNetplayInitialSync({
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
  });

  const resetSyncRuntime = useCallback(() => {
    resetInitialSyncRuntime();
    resetResyncRuntime();
  }, [resetInitialSyncRuntime, resetResyncRuntime]);

  return {
    handleEmulatorReady,
    handlePeerReady,
    handlePeerResyncFailed,
    handlePeerResyncState,
    handlePeerSaveState,
    handlePeerStartSignal,
    handlePeerStateLoaded,
    handleResyncFailed,
    handleResyncLoaded,
    handleResyncState,
    handleSaveState,
    handleSaveStateError,
    handleStateLoaded,
    resetSyncRuntime,
  };
}
