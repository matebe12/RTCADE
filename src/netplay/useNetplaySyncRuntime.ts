import { useCallback, useEffect, useRef, type MutableRefObject, type RefObject } from "react";

import {
  loadSaveState,
  requestResyncGetState,
  requestResyncLoadState,
  requestSaveState,
  sendStartGame,
} from "@/components/EmulatorPlayer";
import type { NetplayPeer } from "@/netplay/peer";

const RESYNC_TIMEOUT_MS = 3000;

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
  const localReadyRef = useRef(false);
  const remoteReadyRef = useRef(false);
  const pendingStateRef = useRef<ArrayBuffer | null>(null);
  const gameStartedRef = useRef(false);
  const resyncIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const resyncInProgressRef = useRef(false);
  const resyncActiveRef = useRef(false);
  const resyncIntervalMsRef = useRef(500);
  const resyncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleNextResync = useCallback(function scheduleNextResyncImpl() {
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
  }, [emulatorRef, roleRef]);

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

  const resetSyncRuntime = useCallback(() => {
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
    localReadyRef.current = false;
    remoteReadyRef.current = false;
    pendingStateRef.current = null;
    gameStartedRef.current = false;
    resyncIntervalMsRef.current = 500;
  }, []);

  const handlePeerReady = useCallback(() => {
    console.log(
      "[LOBBY] onPeerReady, role:",
      roleRef.current,
      "localReady:",
      localReadyRef.current,
    );
    remoteReadyRef.current = true;
    if (roleRef.current === "host" && localReadyRef.current) {
      updateSync("세이브 스테이트 추출 중...");
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
          updateSync("세이브 스테이트 로드 중...");
          loadSaveState(emulatorRef, stateBuffer);
        } else {
          pendingStateRef.current = stateBuffer;
          updateSync("세이브 스테이트 수신 완료, 에뮬레이터 대기 중...");
        }
      }
    },
    [emulatorRef, roleRef, updateSync],
  );

  const handlePeerStateLoaded = useCallback(() => {
    if (roleRef.current === "host") {
      console.log("[LOBBY] HOST: GUEST state loaded, starting both!");
      updateSync("양쪽 동기화 완료! 게임 시작!");
      markSessionStarted();
      setGameStarted(true);
      gameStartedRef.current = true;
      sendStartGame(emulatorRef);
      peerRef.current?.sendStartSignal();
      startPeriodicResync();
    }
  }, [emulatorRef, markSessionStarted, peerRef, roleRef, setGameStarted, startPeriodicResync, updateSync]);

  const handlePeerStartSignal = useCallback(() => {
    if (roleRef.current === "guest" && !gameStartedRef.current) {
      console.log("[LOBBY] GUEST: received start signal from HOST!");
      updateSync("양쪽 동기화 완료! 게임 시작!");
      markSessionStarted();
      setGameStarted(true);
      gameStartedRef.current = true;
      sendStartGame(emulatorRef);
    }
  }, [emulatorRef, markSessionStarted, roleRef, setGameStarted, updateSync]);

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

  const handleEmulatorReady = useCallback(() => {
    localReadyRef.current = true;
    console.log(
      "[LOBBY] handleEmulatorReady, role:",
      roleRef.current,
      "remoteReady:",
      remoteReadyRef.current,
    );

    if (roleRef.current === "host") {
      updateSync("에뮬레이터 로딩 완료 (HOST). 상대방 대기 중...");
      if (remoteReadyRef.current) {
        updateSync("세이브 스테이트 추출 중...");
        requestSaveState(emulatorRef);
      }
    } else {
      updateSync("에뮬레이터 로딩 완료 (GUEST). HOST 대기 중...");
      peerRef.current?.sendPeerReady();
      if (pendingStateRef.current) {
        updateSync("세이브 스테이트 로드 중...");
        loadSaveState(emulatorRef, pendingStateRef.current);
        pendingStateRef.current = null;
      }
    }
  }, [emulatorRef, peerRef, roleRef, updateSync]);

  const handleSaveState = useCallback(
    (stateBuffer: ArrayBuffer) => {
      if (roleRef.current === "host") {
        updateSync(`세이브 스테이트 전송 중... (${(stateBuffer.byteLength / 1024).toFixed(0)}KB)`);
        peerRef.current?.sendSaveState(stateBuffer);
      }
    },
    [peerRef, roleRef, updateSync],
  );

  const handleStateLoaded = useCallback(() => {
    console.log("[LOBBY] handleStateLoaded, role:", roleRef.current);
    if (roleRef.current === "guest" && !gameStartedRef.current) {
      updateSync("세이브 스테이트 로드 완료! HOST 시작 대기...");
      peerRef.current?.sendStateLoaded();
    }
  }, [peerRef, roleRef, updateSync]);

  const handleSaveStateError = useCallback(
    (error: string) => {
      console.warn("[NETPLAY] Save state error:", error);
      updateSync(`세이브 스테이트 실패 (${error}). 동시 시작으로 폴백...`);
      if (roleRef.current === "host") {
        setTimeout(() => {
          if (!gameStartedRef.current) {
            console.log("[LOBBY] HOST: fallback start (no state sync)");
            updateSync("동시 시작! (스테이트 동기화 없음)");
            markSessionStarted();
            setGameStarted(true);
            gameStartedRef.current = true;
            sendStartGame(emulatorRef);
            peerRef.current?.sendStartSignal();
          }
        }, 500);
      }
    },
    [emulatorRef, markSessionStarted, peerRef, roleRef, setGameStarted, updateSync],
  );

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