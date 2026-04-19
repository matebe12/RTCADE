import { useCallback, useRef, type MutableRefObject, type RefObject } from "react";

import type { NetplayPeer } from "@/netplay/peer";
import type { ResyncStatePayload } from "@/netplay/peer";
import { useNetplayInitialSync } from "@/netplay/useNetplayInitialSync";
import { useNetplayResyncLoop } from "@/netplay/useNetplayResyncLoop";
import type { SystemCore } from "@/components/EmulatorPlayer";

interface UseNetplaySyncRuntimeOptions {
  dcState: string;
  gameStarted: boolean;
  peerRef: MutableRefObject<NetplayPeer | null>;
  emulatorRef: RefObject<HTMLIFrameElement | null>;
  roleRef: MutableRefObject<"host" | "guest" | null>;
  lastInputTimeRef: MutableRefObject<number>;
  sessionCoreRef: MutableRefObject<SystemCore | null>;
  /** When true, use video streaming instead of state sync */
  videoStreamingMode?: boolean;
  onGuestResyncLoaded?: () => void;
  onGuestResyncFailed?: () => void;
  onGuestResyncState?: (payload: ResyncStatePayload) => void;
  setGameStarted: (gameStarted: boolean) => void;
  updateSync: (message: string) => void;
  markSessionStarted: () => void;
  onStartVideoCapture?: () => void;
}

export function useNetplaySyncRuntime({
  dcState,
  gameStarted,
  peerRef,
  emulatorRef,
  roleRef,
  lastInputTimeRef,
  sessionCoreRef,
  videoStreamingMode,
  onGuestResyncLoaded,
  onGuestResyncFailed,
  onGuestResyncState,
  setGameStarted,
  updateSync,
  markSessionStarted,
  onStartVideoCapture,
}: UseNetplaySyncRuntimeOptions) {
  const gameStartedRef = useRef(false);
  const {
    handlePeerResyncLoaded,
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
    lastInputTimeRef,
    sessionCoreRef,
    videoStreamingMode,
    onGuestResyncLoaded,
    onGuestResyncFailed,
    onGuestResyncState,
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
    onStartVideoCapture,
  });
  const resetSyncRuntime = useCallback(() => {
    resetInitialSyncRuntime();
    resetResyncRuntime();
  }, [resetInitialSyncRuntime, resetResyncRuntime]);

  return {
    handleEmulatorReady,
    handlePeerReady,
    handlePeerResyncLoaded,
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
