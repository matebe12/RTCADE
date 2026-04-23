import { useCallback, useEffect, type MutableRefObject } from "react";

import type { SessionEndReason } from "@/components/NetplaySessionSummary";
import type { NetplayPeer } from "@/netplay/peer";
import {
  type ActiveSession,
  type LobbyState,
  type OpponentProfile,
  type SessionSummaryState,
} from "@/stores/useNetplayLobbyStore";
import type { NetplaySessionRole } from "../../shared/emulator-protocol";

type SetLobbyState = (next: LobbyState | ((previous: LobbyState) => LobbyState)) => void;

interface UseNetplaySessionLifecycleOptions {
  state: LobbyState;
  setLobbyState: SetLobbyState;
  peerRef: MutableRefObject<NetplayPeer | null>;
  roleRef: MutableRefObject<NetplaySessionRole | null>;
  activeSessionRef: MutableRefObject<ActiveSession | null>;
  opponentProfileRef: MutableRefObject<OpponentProfile | null>;
  sessionStartedAtRef: MutableRefObject<number | null>;
  resetSyncRuntime: () => void;
  resetChatRuntime: () => void;
  resetSessionUiState: () => void;
  buildSessionSummary: (endReason: SessionEndReason) => SessionSummaryState | null;
  recordRecentOpponent: (endReason: SessionEndReason) => void;
  fetchRoms: () => Promise<void>;
}

export function useNetplaySessionLifecycle({
  state,
  setLobbyState: setState,
  peerRef,
  roleRef,
  activeSessionRef,
  opponentProfileRef,
  sessionStartedAtRef,
  resetSyncRuntime,
  resetChatRuntime,
  resetSessionUiState,
  buildSessionSummary,
  recordRecentOpponent,
  fetchRoms,
}: UseNetplaySessionLifecycleOptions) {
  useEffect(() => {
    return () => {
      peerRef.current?.close();
    };
  }, [peerRef]);

  const resetSessionRuntime = useCallback(() => {
    peerRef.current?.close();
    peerRef.current = null;
    roleRef.current = null;
    activeSessionRef.current = null;
    opponentProfileRef.current = null;
    sessionStartedAtRef.current = null;
    resetSyncRuntime();
    resetSessionUiState();
    resetChatRuntime();
  }, [
    activeSessionRef,
    opponentProfileRef,
    peerRef,
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
