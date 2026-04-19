import { useCallback, useEffect, useRef, type MutableRefObject, type RefObject } from "react";

import { requestResyncGetState, requestResyncLoadState } from "@/components/EmulatorPlayer";
import type { SystemCore } from "@/components/EmulatorPlayer";
import type { NetplayPeer } from "@/netplay/peer";

const DEFAULT_RESYNC_PROFILE = {
  ackTimeoutMs: 4500,
  backoffStepMs: 500,
  baseIntervalMs: 1000,
  largeStatePenaltyMs: 600,
  maxIntervalMs: 5000,
  startDelayMs: 1500,
  veryLargeStatePenaltyMs: 1600,
};

const ARCADE_RESYNC_PROFILE = {
  ackTimeoutMs: 6500,
  backoffStepMs: 900,
  baseIntervalMs: 1800,
  largeStatePenaltyMs: 1000,
  maxIntervalMs: 7500,
  startDelayMs: 3500,
  veryLargeStatePenaltyMs: 2200,
};

const MAME2003_RESYNC_PROFILE = {
  ackTimeoutMs: 7500,
  backoffStepMs: 1200,
  baseIntervalMs: 2600,
  largeStatePenaltyMs: 1400,
  maxIntervalMs: 9000,
  startDelayMs: 4500,
  veryLargeStatePenaltyMs: 2800,
};

function getResyncProfile(core: SystemCore | null) {
  if (core === "mame2003" || core === "mame2003_plus") {
    return MAME2003_RESYNC_PROFILE;
  }

  if (core === "arcade" || core === "fbneo") {
    return ARCADE_RESYNC_PROFILE;
  }

  return DEFAULT_RESYNC_PROFILE;
}

function getIntervalForStateSize(core: SystemCore | null, stateBuffer: ArrayBuffer) {
  const profile = getResyncProfile(core);
  const sizeKB = stateBuffer.byteLength / 1024;

  if (sizeKB > 2048) {
    return profile.baseIntervalMs + profile.veryLargeStatePenaltyMs;
  }

  if (sizeKB > 500) {
    return profile.baseIntervalMs + profile.largeStatePenaltyMs;
  }

  return profile.baseIntervalMs;
}

interface UseNetplayResyncLoopOptions {
  peerRef: MutableRefObject<NetplayPeer | null>;
  emulatorRef: RefObject<HTMLIFrameElement | null>;
  roleRef: MutableRefObject<"host" | "guest" | null>;
  gameStartedRef: MutableRefObject<boolean>;
  sessionCoreRef: MutableRefObject<SystemCore | null>;
}

export function useNetplayResyncLoop({
  peerRef,
  emulatorRef,
  roleRef,
  gameStartedRef,
  sessionCoreRef,
}: UseNetplayResyncLoopOptions) {
  const resyncIntervalRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resyncInProgressRef = useRef(false);
  const resyncActiveRef = useRef(false);
  const resyncIntervalMsRef = useRef(DEFAULT_RESYNC_PROFILE.baseIntervalMs);
  const resyncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resyncStartedAtRef = useRef<number | null>(null);

  const clearResyncTimeout = useCallback(() => {
    if (resyncTimeoutRef.current) {
      clearTimeout(resyncTimeoutRef.current);
      resyncTimeoutRef.current = null;
    }
  }, []);

  const increaseResyncInterval = useCallback((reason: string) => {
    const profile = getResyncProfile(sessionCoreRef.current);
    resyncIntervalMsRef.current = Math.min(
      profile.maxIntervalMs,
      Math.max(profile.baseIntervalMs, resyncIntervalMsRef.current + profile.backoffStepMs),
    );
    console.warn(
      `[LOBBY] Resync ${reason}, backing off to ${resyncIntervalMsRef.current}ms for ${sessionCoreRef.current ?? "default"}`,
    );
  }, [sessionCoreRef]);

  const scheduleNextResync = useCallback(
    function scheduleNextResyncImpl(delayMs?: number) {
      if (!resyncActiveRef.current || roleRef.current !== "host" || !gameStartedRef.current) return;
      if (resyncIntervalRef.current) clearTimeout(resyncIntervalRef.current);
      const nextDelay = delayMs ?? resyncIntervalMsRef.current;
      resyncIntervalRef.current = setTimeout(() => {
        if (resyncActiveRef.current && gameStartedRef.current && !resyncInProgressRef.current) {
          resyncInProgressRef.current = true;
          resyncStartedAtRef.current = Date.now();
          const profile = getResyncProfile(sessionCoreRef.current);
          resyncTimeoutRef.current = setTimeout(() => {
            if (resyncInProgressRef.current) {
              resyncInProgressRef.current = false;
              resyncStartedAtRef.current = null;
              clearResyncTimeout();
              increaseResyncInterval("timeout");
              scheduleNextResyncImpl();
            }
          }, profile.ackTimeoutMs);
          requestResyncGetState(emulatorRef);
        } else {
          scheduleNextResyncImpl();
        }
      }, nextDelay);
    },
    [clearResyncTimeout, emulatorRef, gameStartedRef, increaseResyncInterval, roleRef, sessionCoreRef],
  );

  const completeHostResync = useCallback(
    (reason: "success" | "timeout" | "backpressure" | "failed") => {
      if (roleRef.current !== "host") return;

      resyncInProgressRef.current = false;
      resyncStartedAtRef.current = null;
      clearResyncTimeout();

      if (reason !== "success") {
        increaseResyncInterval(reason);
      }

      if (resyncActiveRef.current) {
        scheduleNextResync();
      }
    },
    [clearResyncTimeout, increaseResyncInterval, roleRef, scheduleNextResync],
  );

  const startPeriodicResync = useCallback(() => {
    const profile = getResyncProfile(sessionCoreRef.current);
    resyncActiveRef.current = true;
    resyncIntervalMsRef.current = profile.baseIntervalMs;
    console.log(
      `[LOBBY] Starting paced resync pipeline for ${sessionCoreRef.current ?? "default"} (delay=${profile.startDelayMs}ms, interval=${profile.baseIntervalMs}ms)`,
    );
    scheduleNextResync(profile.startDelayMs);
  }, [scheduleNextResync, sessionCoreRef]);

  useEffect(() => {
    return () => {
      resyncActiveRef.current = false;
      if (resyncIntervalRef.current) clearTimeout(resyncIntervalRef.current);
      clearResyncTimeout();
    };
  }, [clearResyncTimeout]);

  const resetResyncRuntime = useCallback(() => {
    resyncActiveRef.current = false;
    if (resyncIntervalRef.current) {
      clearTimeout(resyncIntervalRef.current);
      resyncIntervalRef.current = null;
    }
    resyncInProgressRef.current = false;
    resyncStartedAtRef.current = null;
    clearResyncTimeout();
    resyncIntervalMsRef.current = DEFAULT_RESYNC_PROFILE.baseIntervalMs;
  }, [clearResyncTimeout]);

  const handlePeerResyncState = useCallback(
    (stateBuffer: ArrayBuffer) => {
      if (roleRef.current === "guest") {
        requestResyncLoadState(emulatorRef, stateBuffer);
        peerRef.current?.resetRemoteSeq();
      }
    },
    [emulatorRef, peerRef, roleRef],
  );

  const handlePeerResyncLoaded = useCallback(() => {
    if (roleRef.current !== "host" || !resyncInProgressRef.current) return;

    const elapsedMs = resyncStartedAtRef.current ? Date.now() - resyncStartedAtRef.current : 0;
    console.log(
      `[LOBBY] Guest resync load complete in ${elapsedMs}ms, next=${resyncIntervalMsRef.current}ms`,
    );
    completeHostResync("success");
  }, [completeHostResync, roleRef]);

  const handlePeerResyncFailed = useCallback(() => {
    if (roleRef.current !== "host") return;

    console.warn("[LOBBY] Peer reported resync failure");
    completeHostResync("failed");
  }, [completeHostResync, roleRef]);

  const handleResyncState = useCallback(
    (stateBuffer: ArrayBuffer) => {
      if (roleRef.current === "host") {
        const sizeKB = stateBuffer.byteLength / 1024;
        resyncIntervalMsRef.current = getIntervalForStateSize(sessionCoreRef.current, stateBuffer);
        console.log(
          `[LOBBY] Resync state ${sizeKB.toFixed(0)}KB for ${sessionCoreRef.current ?? "default"}, next=${resyncIntervalMsRef.current}ms`,
        );
        const sent = peerRef.current?.sendResyncState(stateBuffer);
        if (!sent) {
          console.warn("[LOBBY] Resync skipped (backpressure)");
          completeHostResync("backpressure");
          return;
        }
      }
    },
    [completeHostResync, peerRef, roleRef, sessionCoreRef],
  );

  const handleResyncLoaded = useCallback(() => {
    console.log("[LOBBY] GUEST resync load complete");
    peerRef.current?.sendResyncLoaded();
  }, [peerRef]);

  const handleResyncFailed = useCallback(() => {
    if (roleRef.current === "guest") {
      peerRef.current?.sendResyncFailed();
      console.warn("[LOBBY] Guest resync load failed");
      return;
    }

    console.warn("[LOBBY] Resync failed locally, scheduling retry");
    completeHostResync("failed");
  }, [completeHostResync, peerRef, roleRef]);

  return {
    handlePeerResyncLoaded,
    handlePeerResyncFailed,
    handlePeerResyncState,
    handleResyncFailed,
    handleResyncLoaded,
    handleResyncState,
    resetResyncRuntime,
    startPeriodicResync,
  };
}
