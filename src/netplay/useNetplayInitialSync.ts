import { useCallback, useEffect, useRef, type MutableRefObject, type RefObject } from "react";

import { loadSaveState, requestSaveState, sendStartGame } from "@/components/EmulatorPlayer";
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
      startGame("양쪽 동기화 완료! 게임 시작!", true);
      startPeriodicResync();
    }
  }, [roleRef, startGame, startPeriodicResync]);

  const handlePeerStartSignal = useCallback(() => {
    if (roleRef.current === "guest" && !gameStartedRef.current) {
      console.log("[LOBBY] GUEST: received start signal from HOST!");
      startGame("양쪽 동기화 완료! 게임 시작!", false);
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
  }, [gameStartedRef, peerRef, roleRef, updateSync]);

  const handleSaveStateError = useCallback(
    (error: string) => {
      console.warn("[NETPLAY] Save state error:", error);
      updateSync(`세이브 스테이트 실패 (${error}). 동시 시작으로 폴백...`);
      if (roleRef.current === "host") {
        setTimeout(() => {
          if (!gameStartedRef.current) {
            console.log("[LOBBY] HOST: fallback start (no state sync)");
            startGame("동시 시작! (스테이트 동기화 없음)", true);
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
