import { useCallback, useEffect, type MutableRefObject } from "react";

import type { SessionEndReason } from "@/components/NetplaySessionSummary";
import { completeGameSession, completeGameSessionWithBeacon } from "@/lib/operations-api";
import type { NetplayPeer } from "@/netplay/peer";
import {
  type ActiveSession,
  type LobbyState,
  type OpponentProfile,
  type SessionSummaryState,
} from "@/stores/useNetplayLobbyStore";
import type { NetplaySessionRole } from "../../shared/emulator-protocol";

type SetLobbyState = (next: LobbyState | ((previous: LobbyState) => LobbyState)) => void;

/** {@link useNetplaySessionLifecycle} hook 옵션 인터페이스. */
interface UseNetplaySessionLifecycleOptions {
  state: LobbyState;
  setLobbyState: SetLobbyState;
  peerRef: MutableRefObject<NetplayPeer | null>;
  roleRef: MutableRefObject<NetplaySessionRole | null>;
  activeSessionRef: MutableRefObject<ActiveSession | null>;
  opponentProfileRef: MutableRefObject<OpponentProfile | null>;
  recordedSessionIdRef: MutableRefObject<string | null>;
  sessionStartedAtRef: MutableRefObject<number | null>;
  resetSyncRuntime: () => void;
  resetChatRuntime: () => void;
  resetSessionUiState: () => void;
  buildSessionSummary: (endReason: SessionEndReason) => SessionSummaryState | null;
  recordRecentOpponent: (endReason: SessionEndReason) => void;
  fetchRoms: () => Promise<void>;
}

/**
 * 넷플레이 세션 시작/종료 생명주기를 관리하는 hook.
 * 세션 종료 시 cleanup, 통계 API 수수, 세션 요약 데이터 생성을 담당한다.
 */
export function useNetplaySessionLifecycle({
  state,
  setLobbyState: setState,
  peerRef,
  roleRef,
  activeSessionRef,
  opponentProfileRef,
  recordedSessionIdRef,
  sessionStartedAtRef,
  resetSyncRuntime,
  resetChatRuntime,
  resetSessionUiState,
  buildSessionSummary,
  recordRecentOpponent,
  fetchRoms,
}: UseNetplaySessionLifecycleOptions) {
  const finalizeRecordedSession = useCallback(
    (useBeacon = false) => {
      const sessionId = recordedSessionIdRef.current;
      recordedSessionIdRef.current = null;

      if (!sessionId) {
        return;
      }

      if (useBeacon) {
        const beaconSent = completeGameSessionWithBeacon(sessionId);
        if (!beaconSent) {
          void completeGameSession(sessionId).catch(() => undefined);
        }
        return;
      }

      void completeGameSession(sessionId).catch(() => undefined);
    },
    [recordedSessionIdRef],
  );

  useEffect(() => {
    return () => {
      finalizeRecordedSession(true);
      peerRef.current?.close();
    };
  }, [finalizeRecordedSession, peerRef]);

  const resetSessionRuntime = useCallback(() => {
    finalizeRecordedSession();
    peerRef.current?.close();
    peerRef.current = null;
    roleRef.current = null;
    activeSessionRef.current = null;
    opponentProfileRef.current = null;
    recordedSessionIdRef.current = null;
    sessionStartedAtRef.current = null;
    resetSyncRuntime();
    resetSessionUiState();
    resetChatRuntime();
  }, [
    activeSessionRef,
    finalizeRecordedSession,
    opponentProfileRef,
    peerRef,
    recordedSessionIdRef,
    resetChatRuntime,
    resetSessionUiState,
    resetSyncRuntime,
    roleRef,
    sessionStartedAtRef,
  ]);

  const resetToMenu = useCallback(() => {
    resetSessionRuntime();
    setState({ step: "menu" });
  }, [resetSessionRuntime, setState]);

  const completeSession = useCallback(
    (endReason: SessionEndReason) => {
      const summary = buildSessionSummary(endReason);
      if (activeSessionRef.current) {
        recordRecentOpponent(endReason);
      }
      resetSessionRuntime();

      if (summary) {
        setState(summary);
        return;
      }

      setState({ step: "menu" });
    },
    [activeSessionRef, buildSessionSummary, recordRecentOpponent, resetSessionRuntime, setState],
  );

  const handleSummaryChooseAnotherGame = useCallback(() => {
    resetSessionRuntime();
    void fetchRoms();
  }, [fetchRoms, resetSessionRuntime]);

  const handleBack = useCallback(() => {
    if (state.step === "playing") {
      completeSession("self-left");
      return;
    }

    if (state.step === "watching") {
      resetToMenu();
      return;
    }

    resetToMenu();
  }, [completeSession, resetToMenu, state.step]);

  return {
    completeSession,
    handleBack,
    handleSummaryChooseAnotherGame,
    resetSessionRuntime,
    resetToMenu,
  };
}
