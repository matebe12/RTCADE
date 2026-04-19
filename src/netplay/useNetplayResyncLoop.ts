import { useCallback, useEffect, useMemo, useRef, type MutableRefObject, type RefObject } from "react";

import type { SystemCore } from "@/components/EmulatorPlayer";
import { createEmulatorRuntimeBridge } from "@/lib/emulator-runtime-bridge";
import type { NetplayPeer, ResyncStatePayload } from "@/netplay/peer";

const DEFAULT_RESYNC_PROFILE = {
  ackTimeoutMs: 4500,
  backoffStepMs: 500,
  baseIntervalMs: 1000,
  idleWindowMs: 700,
  largeStatePenaltyMs: 600,
  maxDeferralMs: 2500,
  maxIntervalMs: 5000,
  startDelayMs: 1500,
  veryLargeStatePenaltyMs: 1600,
};

const ARCADE_RESYNC_PROFILE = {
  ackTimeoutMs: 3000,
  backoffStepMs: 200,
  baseIntervalMs: 400,
  idleWindowMs: 80,
  largeStatePenaltyMs: 100,
  maxDeferralMs: 200,
  maxIntervalMs: 1200,
  startDelayMs: 500,
  veryLargeStatePenaltyMs: 250,
};

const MAME2003_RESYNC_PROFILE = {
  ackTimeoutMs: 3500,
  backoffStepMs: 250,
  baseIntervalMs: 500,
  idleWindowMs: 100,
  largeStatePenaltyMs: 120,
  maxDeferralMs: 250,
  maxIntervalMs: 1500,
  startDelayMs: 600,
  veryLargeStatePenaltyMs: 300,
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
  emulatorRef: RefObject<HTMLDivElement | null>;
  roleRef: MutableRefObject<"host" | "guest" | null>;
  gameStartedRef: MutableRefObject<boolean>;
  lastInputTimeRef: MutableRefObject<number>;
  sessionCoreRef: MutableRefObject<SystemCore | null>;
  /** When true, skip all periodic resync (video streaming mode). */
  videoStreamingMode?: boolean;
  onGuestResyncLoaded?: () => void;
  onGuestResyncFailed?: () => void;
  onGuestResyncState?: (payload: ResyncStatePayload) => void;
}

export function useNetplayResyncLoop({
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
}: UseNetplayResyncLoopOptions) {
  const resyncIntervalRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resyncInProgressRef = useRef(false);
  const resyncActiveRef = useRef(false);
  const resyncIntervalMsRef = useRef(DEFAULT_RESYNC_PROFILE.baseIntervalMs);
  const resyncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resyncStartedAtRef = useRef<number | null>(null);
  const deferredSinceRef = useRef<number | null>(null);
  const guestResyncApplyStartedAtRef = useRef<number | null>(null);
  const guestResyncStatsRef = useRef<ResyncStatePayload["stats"] | null>(null);
  const guestResyncCountRef = useRef(0);
  const guestResyncAggregateRef = useRef({
    applyMs: 0,
    compressedBytes: 0,
    decompressMs: 0,
    rawBytes: 0,
    receiveMs: 0,
  });
  const emulatorRuntime = useMemo(() => createEmulatorRuntimeBridge(emulatorRef), [emulatorRef]);

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
        const profile = getResyncProfile(sessionCoreRef.current);

        if (resyncActiveRef.current && gameStartedRef.current && !resyncInProgressRef.current) {
          const lastInputAt = lastInputTimeRef.current;
          const idleForMs = lastInputAt > 0 ? Date.now() - lastInputAt : Number.POSITIVE_INFINITY;
          const deferredSince = deferredSinceRef.current;
          const deferredForMs = deferredSince ? Date.now() - deferredSince : 0;

          if (idleForMs < profile.idleWindowMs && deferredForMs < profile.maxDeferralMs) {
            if (deferredSinceRef.current === null) {
              deferredSinceRef.current = Date.now();
            }

            const retryDelay = Math.max(250, profile.idleWindowMs - idleForMs);
            console.log(
              `[LOBBY] Resync deferred until idle window (${idleForMs}ms/${profile.idleWindowMs}ms, deferred=${deferredForMs}ms/${profile.maxDeferralMs}ms) for ${sessionCoreRef.current ?? "default"}`,
            );
            scheduleNextResyncImpl(retryDelay);
            return;
          }

          if (idleForMs < profile.idleWindowMs && deferredForMs >= profile.maxDeferralMs) {
            console.warn(
              `[LOBBY] Forcing resync after max deferral (${deferredForMs}ms) for ${sessionCoreRef.current ?? "default"}`,
            );
          }

          deferredSinceRef.current = null;

          resyncInProgressRef.current = true;
          resyncStartedAtRef.current = Date.now();
          resyncTimeoutRef.current = setTimeout(() => {
            if (resyncInProgressRef.current) {
              resyncInProgressRef.current = false;
              resyncStartedAtRef.current = null;
              clearResyncTimeout();
              increaseResyncInterval("timeout");
              scheduleNextResyncImpl();
            }
          }, profile.ackTimeoutMs);
          // Direct call: get resync state synchronously and send to peer
          const stateBuffer = emulatorRuntime.sync.getResyncState();
          if (stateBuffer) {
            const sizeKB = stateBuffer.byteLength / 1024;
            resyncIntervalMsRef.current = getIntervalForStateSize(sessionCoreRef.current, stateBuffer);
            console.log(
              `[LOBBY] Resync state ${sizeKB.toFixed(0)}KB for ${sessionCoreRef.current ?? "default"}, next=${resyncIntervalMsRef.current}ms`,
            );
            const sent = peerRef.current?.sendResyncState(stateBuffer);
            if (!sent) {
              console.warn("[LOBBY] Resync skipped (backpressure)");
              // Inline backpressure handling (avoids circular dep with completeHostResync)
              resyncInProgressRef.current = false;
              resyncStartedAtRef.current = null;
              deferredSinceRef.current = null;
              clearResyncTimeout();
              increaseResyncInterval("backpressure");
              scheduleNextResyncImpl();
            }
            // Otherwise: wait for peer ACK (handlePeerResyncLoaded/Failed)
          } else {
            console.warn("[LOBBY] Resync state null, scheduling retry");
            resyncInProgressRef.current = false;
            resyncStartedAtRef.current = null;
            deferredSinceRef.current = null;
            clearResyncTimeout();
            increaseResyncInterval("failed");
            scheduleNextResyncImpl();
          }
        } else {
          scheduleNextResyncImpl();
        }
      }, nextDelay);
    },
    [
      clearResyncTimeout,
      emulatorRuntime,
      gameStartedRef,
      increaseResyncInterval,
      lastInputTimeRef,
      peerRef,
      roleRef,
      sessionCoreRef,
    ],
  );

  const completeHostResync = useCallback(
    (reason: "success" | "timeout" | "backpressure" | "failed") => {
      if (roleRef.current !== "host") return;

      resyncInProgressRef.current = false;
      resyncStartedAtRef.current = null;
      deferredSinceRef.current = null;
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
    // In video streaming mode, resync is not needed — HOST streams video directly
    if (videoStreamingMode) {
      console.log("[LOBBY] Resync skipped (video streaming mode)");
      return;
    }

    const profile = getResyncProfile(sessionCoreRef.current);
    resyncActiveRef.current = true;
    resyncIntervalMsRef.current = profile.baseIntervalMs;
    console.log(
      `[LOBBY] Starting paced resync pipeline for ${sessionCoreRef.current ?? "default"} (delay=${profile.startDelayMs}ms, interval=${profile.baseIntervalMs}ms)`,
    );
    scheduleNextResync(profile.startDelayMs);
  }, [scheduleNextResync, sessionCoreRef, videoStreamingMode]);

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
    deferredSinceRef.current = null;
    clearResyncTimeout();
    resyncIntervalMsRef.current = DEFAULT_RESYNC_PROFILE.baseIntervalMs;
  }, [clearResyncTimeout]);

  const handlePeerResyncState = useCallback(
    (payload: ResyncStatePayload) => {
      if (roleRef.current === "guest") {
        guestResyncApplyStartedAtRef.current = performance.now();
        guestResyncStatsRef.current = payload.stats;
        console.log(
          `[LOBBY] Guest resync received raw=${(payload.stats.rawBytes / 1024).toFixed(0)}KB compressed=${(payload.stats.compressedBytes / 1024).toFixed(0)}KB receive=${payload.stats.receiveMs.toFixed(1)}ms inflate=${payload.stats.decompressMs.toFixed(1)}ms`,
        );
        onGuestResyncState?.(payload);
        emulatorRuntime.sync.loadResyncState(payload.stateBuffer);
        peerRef.current?.resetRemoteSeq(payload.remoteInputSeq + 1);
      }
    },
    [emulatorRuntime, onGuestResyncState, peerRef, roleRef],
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

    const payloadStats = guestResyncStatsRef.current;
    const applyMs = guestResyncApplyStartedAtRef.current
      ? Math.max(0, performance.now() - guestResyncApplyStartedAtRef.current)
      : 0;

    if (payloadStats) {
      guestResyncCountRef.current += 1;
      guestResyncAggregateRef.current.applyMs += applyMs;
      guestResyncAggregateRef.current.compressedBytes += payloadStats.compressedBytes;
      guestResyncAggregateRef.current.decompressMs += payloadStats.decompressMs;
      guestResyncAggregateRef.current.rawBytes += payloadStats.rawBytes;
      guestResyncAggregateRef.current.receiveMs += payloadStats.receiveMs;

      const sampleCount = guestResyncCountRef.current;
      console.log(
        `[LOBBY] Guest resync apply=${applyMs.toFixed(1)}ms totals avg(raw=${(guestResyncAggregateRef.current.rawBytes / sampleCount / 1024).toFixed(0)}KB compressed=${(guestResyncAggregateRef.current.compressedBytes / sampleCount / 1024).toFixed(0)}KB receive=${(guestResyncAggregateRef.current.receiveMs / sampleCount).toFixed(1)}ms inflate=${(guestResyncAggregateRef.current.decompressMs / sampleCount).toFixed(1)}ms apply=${(guestResyncAggregateRef.current.applyMs / sampleCount).toFixed(1)}ms)`,
      );
    }

    guestResyncApplyStartedAtRef.current = null;
    guestResyncStatsRef.current = null;
    onGuestResyncLoaded?.();
    peerRef.current?.sendResyncLoaded();
  }, [onGuestResyncLoaded, peerRef]);

  const handleResyncFailed = useCallback(() => {
    if (roleRef.current === "guest") {
      guestResyncApplyStartedAtRef.current = null;
      guestResyncStatsRef.current = null;
      onGuestResyncFailed?.();
      peerRef.current?.sendResyncFailed();
      console.warn("[LOBBY] Guest resync load failed");
      return;
    }

    console.warn("[LOBBY] Resync failed locally, scheduling retry");
    completeHostResync("failed");
  }, [completeHostResync, onGuestResyncFailed, peerRef, roleRef]);

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
