import { useCallback, type MutableRefObject } from "react";

import type { SessionEndReason } from "@/components/NetplaySessionSummary";
import { parseRomName } from "@/lib/game-names";
import { recordGameSession } from "@/lib/operations-api";
import {
  incrementTotalPlayedCount,
  type RecentGame,
  type RecentOpponent,
  upsertRecentGame,
  upsertRecentOpponent,
} from "@/lib/user-profile";
import {
  type ActiveSession,
  type OpponentProfile,
  type SessionSummaryState,
} from "@/stores/useNetplayLobbyStore";

function getRomFilename(romPath: string) {
  return romPath.split("/").pop() ?? romPath;
}

interface UseNetplaySessionHistoryOptions {
  activeSessionRef: MutableRefObject<ActiveSession | null>;
  opponentProfileRef: MutableRefObject<OpponentProfile | null>;
  sessionStartedAtRef: MutableRefObject<number | null>;
  setRecentGames: (recentGames: RecentGame[]) => void;
  setRecentOpponents: (recentOpponents: RecentOpponent[]) => void;
}

export function useNetplaySessionHistory({
  activeSessionRef,
  opponentProfileRef,
  sessionStartedAtRef,
  setRecentGames,
  setRecentOpponents,
}: UseNetplaySessionHistoryOptions) {
  const recordRecentGame = useCallback(
    (session: ActiveSession) => {
      const nextRecentGames = upsertRecentGame({
        romPath: session.romPath,
        core: session.core,
        displayName: parseRomName(getRomFilename(session.romPath), session.core),
        playedAt: Date.now(),
      });
      setRecentGames(nextRecentGames);
    },
    [setRecentGames],
  );

  const recordRecentOpponent = useCallback(
    (endReason: SessionEndReason) => {
      const activeSession = activeSessionRef.current;
      const opponentProfile = opponentProfileRef.current;

      if (!activeSession || !opponentProfile || sessionStartedAtRef.current === null) return;

      const nextRecentOpponents = upsertRecentOpponent({
        nickname: opponentProfile.nickname,
        avatar: opponentProfile.avatar,
        romPath: activeSession.romPath,
        core: activeSession.core,
        biosPath: activeSession.biosPath,
        gameName: parseRomName(getRomFilename(activeSession.romPath), activeSession.core),
        playedAt: Date.now(),
        playCount: 1,
        lastEndReason: endReason,
      });
      setRecentOpponents(nextRecentOpponents);
    },
    [activeSessionRef, opponentProfileRef, sessionStartedAtRef, setRecentOpponents],
  );

  const markSessionStarted = useCallback(() => {
    if (sessionStartedAtRef.current !== null) return;

    sessionStartedAtRef.current = Date.now();
    const activeSession = activeSessionRef.current;

    if (activeSession) {
      const gameName = parseRomName(getRomFilename(activeSession.romPath), activeSession.core);

      recordRecentGame(activeSession);
      incrementTotalPlayedCount();

      if (activeSession.role === "host") {
        void recordGameSession({
          core: activeSession.core,
          gameName,
          romPath: activeSession.romPath,
        }).catch(() => undefined);
      }
    }
  }, [activeSessionRef, recordRecentGame, sessionStartedAtRef]);

  const buildSessionSummary = useCallback(
    (endReason: SessionEndReason): SessionSummaryState | null => {
      const activeSession = activeSessionRef.current;
      if (!activeSession) return null;

      const endedAt = Date.now();
      const startedAt = sessionStartedAtRef.current;

      return {
        step: "session-summary",
        ...activeSession,
        gameName: parseRomName(getRomFilename(activeSession.romPath), activeSession.core),
        startedAt,
        endedAt,
        durationMs: startedAt ? Math.max(0, endedAt - startedAt) : 0,
        endReason,
        opponentProfile: opponentProfileRef.current,
      };
    },
    [activeSessionRef, opponentProfileRef, sessionStartedAtRef],
  );

  return {
    buildSessionSummary,
    markSessionStarted,
    recordRecentOpponent,
  };
}
