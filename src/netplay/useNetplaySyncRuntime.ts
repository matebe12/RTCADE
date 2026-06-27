import { useCallback, useRef, type MutableRefObject, type RefObject } from "react";

import type { NetplayPeer } from "@/netplay/peer";
import { useNetplayInitialSync } from "@/netplay/useNetplayInitialSync";
import type { NetplaySessionRole } from "../../shared/emulator-protocol";

/** {@link useNetplaySyncRuntime} hook 옵션 인터페이스. */
interface UseNetplaySyncRuntimeOptions {
  dcState: string;
  gameStarted: boolean;
  peerRef: MutableRefObject<NetplayPeer | null>;
  emulatorRef: RefObject<HTMLDivElement | null>;
  roleRef: MutableRefObject<NetplaySessionRole | null>;
  setGameStarted: (gameStarted: boolean) => void;
  updateSync: (message: string) => void;
  markSessionStarted: () => void;
  onHostGameStarted?: () => void;
  onStartVideoCapture?: () => void;
}

/**
 * `useNetplayInitialSync`의 래퍼 hook.
 * 게임 시작 동기화 런타임 핸들러를 제공하고,
 * 세션 리셋 시 관련 상태를 일괄 정리한다.
 */
export function useNetplaySyncRuntime({
  dcState,
  gameStarted,
  peerRef,
  emulatorRef,
  roleRef,
  setGameStarted,
  updateSync,
  markSessionStarted,
  onHostGameStarted,
  onStartVideoCapture,
}: UseNetplaySyncRuntimeOptions) {
  const gameStartedRef = useRef(false);

  const {
    handleEmulatorReady,
    handlePeerReady,
    handlePeerStartSignal,
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
    onHostGameStarted,
    onStartVideoCapture,
  });

  const resetSyncRuntime = useCallback(() => {
    resetInitialSyncRuntime();
  }, [resetInitialSyncRuntime]);

  return {
    handleEmulatorReady,
    handlePeerReady,
    handlePeerStartSignal,
    resetSyncRuntime,
  };
}
