import { useCallback, useEffect, useRef, type MutableRefObject, type RefObject } from "react";

import { requestResyncGetState, requestResyncLoadState } from "@/components/EmulatorPlayer";
import type { NetplayPeer } from "@/netplay/peer";

const RESYNC_TIMEOUT_MS = 3000;

interface UseNetplayResyncLoopOptions {
  peerRef: MutableRefObject<NetplayPeer | null>;
  emulatorRef: RefObject<HTMLIFrameElement | null>;
  roleRef: MutableRefObject<"host" | "guest" | null>;
  gameStartedRef: MutableRefObject<boolean>;
}

export function useNetplayResyncLoop({
  peerRef,
  emulatorRef,
  roleRef,
  gameStartedRef,
}: UseNetplayResyncLoopOptions) {
  const resyncIntervalRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resyncInProgressRef = useRef(false);
  const resyncActiveRef = useRef(false);
  const resyncIntervalMsRef = useRef(500);
  const resyncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleNextResync = useCallback(
    function scheduleNextResyncImpl() {
      if (!resyncActiveRef.current || roleRef.current !== "host" || !gameStartedRef.current) return;
      if (resyncIntervalRef.current) clearTimeout(resyncIntervalRef.current);
      resyncIntervalRef.current = setTimeout(() => {
        if (resyncActiveRef.current && gameStartedRef.current && !resyncInProgressRef.current) {
          resyncInProgressRef.current = true;
          resyncTimeoutRef.current = setTimeout(() => {
            if (resyncInProgressRef.current) {
              console.warn("[LOBBY] Resync timeout, unlocking");
              resyncInProgressRef.current = false;
              scheduleNextResyncImpl();
            }
          }, RESYNC_TIMEOUT_MS);
          requestResyncGetState(emulatorRef);
        } else {
          scheduleNextResyncImpl();
        }
      }, resyncIntervalMsRef.current);
    },
    [emulatorRef, gameStartedRef, roleRef],
  );

  const startPeriodicResync = useCallback(() => {
    resyncActiveRef.current = true;
    console.log("[LOBBY] Starting continuous resync pipeline");
    scheduleNextResync();
  }, [scheduleNextResync]);

  useEffect(() => {
    return () => {
      resyncActiveRef.current = false;
      if (resyncIntervalRef.current) clearTimeout(resyncIntervalRef.current);
      if (resyncTimeoutRef.current) clearTimeout(resyncTimeoutRef.current);
    };
  }, []);

  const resetResyncRuntime = useCallback(() => {
    resyncActiveRef.current = false;
    if (resyncIntervalRef.current) {
      clearTimeout(resyncIntervalRef.current);
      resyncIntervalRef.current = null;
    }
    resyncInProgressRef.current = false;
    if (resyncTimeoutRef.current) {
      clearTimeout(resyncTimeoutRef.current);
      resyncTimeoutRef.current = null;
    }
    resyncIntervalMsRef.current = 500;
  }, []);

  const handlePeerResyncState = useCallback(
    (stateBuffer: ArrayBuffer) => {
      if (roleRef.current === "guest") {
        requestResyncLoadState(emulatorRef, stateBuffer);
        peerRef.current?.resetRemoteSeq();
      }
    },
    [emulatorRef, peerRef, roleRef],
  );

  const handlePeerResyncFailed = useCallback(() => {
    resyncInProgressRef.current = false;
    console.warn("[LOBBY] Resync failed");
  }, []);

  const handleResyncState = useCallback(
    (stateBuffer: ArrayBuffer) => {
      if (roleRef.current === "host") {
        const sizeKB = stateBuffer.byteLength / 1024;
        if (sizeKB > 2048) {
          resyncIntervalMsRef.current = 3000;
        } else if (sizeKB > 500) {
          resyncIntervalMsRef.current = 1500;
        }
        console.log(
          `[LOBBY] Resync state ${sizeKB.toFixed(0)}KB, interval=${resyncIntervalMsRef.current}ms`,
        );
        const sent = peerRef.current?.sendResyncState(stateBuffer);
        if (!sent) {
          console.warn("[LOBBY] Resync skipped (backpressure)");
        }
        resyncInProgressRef.current = false;
        if (resyncTimeoutRef.current) {
          clearTimeout(resyncTimeoutRef.current);
          resyncTimeoutRef.current = null;
        }
        scheduleNextResync();
      }
    },
    [peerRef, roleRef, scheduleNextResync],
  );

  const handleResyncLoaded = useCallback(() => {
    console.log("[LOBBY] GUEST resync load complete");
  }, []);

  const handleResyncFailed = useCallback(() => {
    resyncInProgressRef.current = false;
    if (resyncTimeoutRef.current) {
      clearTimeout(resyncTimeoutRef.current);
      resyncTimeoutRef.current = null;
    }
    console.warn("[LOBBY] Resync failed locally, scheduling retry");
    scheduleNextResync();
  }, [scheduleNextResync]);

  return {
    handlePeerResyncFailed,
    handlePeerResyncState,
    handleResyncFailed,
    handleResyncLoaded,
    handleResyncState,
    resetResyncRuntime,
    startPeriodicResync,
  };
}
