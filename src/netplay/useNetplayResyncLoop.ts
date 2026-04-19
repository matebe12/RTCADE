import { useCallback, useEffect, useRef, type MutableRefObject, type RefObject } from "react";

import { requestResyncGetState, requestResyncLoadState } from "@/components/EmulatorPlayer";
import type { SystemCore } from "@/components/EmulatorPlayer";
import type { NetplayPeer } from "@/netplay/peer";

const CONTINUOUS_RESYNC_TRIAL = true;

const BALANCED_DEFAULT_RESYNC_PROFILE = {
  ackTimeoutMs: 4500,
  backoffStepMs: 500,
  baseIntervalMs: 1000,
  largeStatePenaltyMs: 600,
  maxIntervalMs: 5000,
  startDelayMs: 1500,
  veryLargeStatePenaltyMs: 1600,
};

const BALANCED_ARCADE_RESYNC_PROFILE = {
  ackTimeoutMs: 6500,
  backoffStepMs: 900,
  baseIntervalMs: 1800,
  largeStatePenaltyMs: 1000,
  maxIntervalMs: 7500,
  startDelayMs: 3500,
  veryLargeStatePenaltyMs: 2200,
};

const BALANCED_MAME2003_RESYNC_PROFILE = {
  ackTimeoutMs: 7500,
  backoffStepMs: 1200,
  baseIntervalMs: 2600,
  largeStatePenaltyMs: 1400,
  maxIntervalMs: 9000,
  startDelayMs: 4500,
  veryLargeStatePenaltyMs: 2800,
};

const CONTINUOUS_DEFAULT_RESYNC_PROFILE = {
  ackTimeoutMs: 4500,
  backoffStepMs: 300,
  baseIntervalMs: 400,
  largeStatePenaltyMs: 350,
  maxIntervalMs: 2800,
  startDelayMs: 900,
  veryLargeStatePenaltyMs: 900,
};

const CONTINUOUS_ARCADE_RESYNC_PROFILE = {
  ackTimeoutMs: 6500,
  backoffStepMs: 500,
  baseIntervalMs: 650,
  largeStatePenaltyMs: 450,
  maxIntervalMs: 4200,
  startDelayMs: 1400,
  veryLargeStatePenaltyMs: 1200,
};

const CONTINUOUS_MAME2003_RESYNC_PROFILE = {
  ackTimeoutMs: 7500,
  backoffStepMs: 700,
  baseIntervalMs: 900,
  largeStatePenaltyMs: 700,
  maxIntervalMs: 5200,
  startDelayMs: 1800,
  veryLargeStatePenaltyMs: 1600,
};

type ResyncProfile = {
  ackTimeoutMs: number;
  backoffStepMs: number;
  baseIntervalMs: number;
  largeStatePenaltyMs: number;
  maxIntervalMs: number;
  startDelayMs: number;
  veryLargeStatePenaltyMs: number;
};

function getBalancedResyncProfile(core: SystemCore | null): ResyncProfile {
  if (core === "mame2003" || core === "mame2003_plus") {
    return BALANCED_MAME2003_RESYNC_PROFILE;
  }

  if (core === "arcade" || core === "fbneo") {
    return BALANCED_ARCADE_RESYNC_PROFILE;
  }

  return BALANCED_DEFAULT_RESYNC_PROFILE;
}

function getContinuousResyncProfile(core: SystemCore | null): ResyncProfile {
  if (core === "mame2003" || core === "mame2003_plus") {
    return CONTINUOUS_MAME2003_RESYNC_PROFILE;
  }

  if (core === "arcade" || core === "fbneo") {
    return CONTINUOUS_ARCADE_RESYNC_PROFILE;
  }

  return CONTINUOUS_DEFAULT_RESYNC_PROFILE;
}

function getResyncProfile(core: SystemCore | null): ResyncProfile {
  return CONTINUOUS_RESYNC_TRIAL
    ? getContinuousResyncProfile(core)
    : getBalancedResyncProfile(core);
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
  const resyncIntervalMsRef = useRef(CONTINUOUS_DEFAULT_RESYNC_PROFILE.baseIntervalMs);
  const resyncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resyncStartedAtRef = useRef<number | null>(null);
  const resyncAttemptCountRef = useRef(0);
  const resyncAppliedCountRef = useRef(0);
  const resyncBackpressureCountRef = useRef(0);
  const resyncFailureCountRef = useRef(0);

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
          resyncAttemptCountRef.current += 1;
          resyncInProgressRef.current = true;
          resyncStartedAtRef.current = Date.now();
          const profile = getResyncProfile(sessionCoreRef.current);
          console.log(
            `[LOBBY] Resync attempt #${resyncAttemptCountRef.current} for ${sessionCoreRef.current ?? "default"} (delay=${nextDelay}ms, trial=${CONTINUOUS_RESYNC_TRIAL ? "continuous" : "balanced"})`,
          );
          resyncTimeoutRef.current = setTimeout(() => {
            if (resyncInProgressRef.current) {
              resyncFailureCountRef.current += 1;
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
      `[LOBBY] Starting ${CONTINUOUS_RESYNC_TRIAL ? "continuous" : "balanced"} resync pipeline for ${sessionCoreRef.current ?? "default"} (delay=${profile.startDelayMs}ms, interval=${profile.baseIntervalMs}ms)`,
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
    resyncAttemptCountRef.current = 0;
    resyncAppliedCountRef.current = 0;
    resyncBackpressureCountRef.current = 0;
    resyncFailureCountRef.current = 0;
    resyncIntervalMsRef.current = getResyncProfile(sessionCoreRef.current).baseIntervalMs;
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

    resyncAppliedCountRef.current += 1;
    const elapsedMs = resyncStartedAtRef.current ? Date.now() - resyncStartedAtRef.current : 0;
    console.log(
      `[LOBBY] Guest resync load complete in ${elapsedMs}ms (attempts=${resyncAttemptCountRef.current}, applied=${resyncAppliedCountRef.current}, failures=${resyncFailureCountRef.current}, backpressure=${resyncBackpressureCountRef.current}, next=${resyncIntervalMsRef.current}ms)`,
    );
    completeHostResync("success");
  }, [completeHostResync, roleRef]);

  const handlePeerResyncFailed = useCallback(() => {
    if (roleRef.current !== "host") return;

    resyncFailureCountRef.current += 1;
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
          resyncBackpressureCountRef.current += 1;
          console.warn("[LOBBY] Resync skipped (backpressure)");
          completeHostResync("backpressure");
          return;
        }
      }
    },
    [completeHostResync, peerRef, roleRef, sessionCoreRef],
  );

  const handleResyncLoaded = useCallback(() => {
    console.log("[LOBBY] GUEST resync load complete, sending ack to host");
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
