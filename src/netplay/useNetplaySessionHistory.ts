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

function createSessionId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

/** {@link useNetplaySessionHistory} hook 옵션 인터페이스. */
interface UseNetplaySessionHistoryOptions {
  activeSessionRef: MutableRefObject<ActiveSession | null>;
  opponentProfileRef: MutableRefObject<OpponentProfile | null>;
  recordedSessionIdRef: MutableRefObject<string | null>;
  sessionStartedAtRef: MutableRefObject<number | null>;
  setRecentGames: (recentGames: RecentGame[]) => void;
  setRecentOpponents: (recentOpponents: RecentOpponent[]) => void;
}

/**
 * 넷플레이 세션 기록(localStorage)과 서버 통계를 관리하는 hook.
 * 최근 게임/상대 목록 저장과 게임 세션 시작 시간 기록, 서버 API 수수를 담당한다.
 */
export function useNetplaySessionHistory({
  activeSessionRef,
  opponentProfileRef,
  recordedSessionIdRef,
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

      if (
        !activeSession ||
        activeSession.mode !== "netplay" ||
        !opponentProfile ||
        sessionStartedAtRef.current === null
      ) {
        return;
      }

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
    if (sessionStartedAtRef.current !== null) return; // 중복 호출 방지

    sessionStartedAtRef.current = Date.now();
    const activeSession = activeSessionRef.current;

    if (activeSession) {
      const gameName = parseRomName(getRomFilename(activeSession.romPath), activeSession.core);

      recordRecentGame(activeSession);
      incrementTotalPlayedCount();

      if (activeSession.mode === "solo" || activeSession.role === "host") {
        // solo나 host만 서버에 세션을 수속한다 (GUEST는 HOST가 기록함)
        const sessionId = recordedSessionIdRef.current ?? createSessionId();
        recordedSessionIdRef.current = sessionId;

        void recordGameSession({
          core: activeSession.core,
          gameName,
          romPath: activeSession.romPath,
          sessionId,
        }).catch(() => undefined);
      }
    }
  }, [activeSessionRef, recordRecentGame, recordedSessionIdRef, sessionStartedAtRef]);

  const buildSessionSummary = useCallback(
    (endReason: SessionEndReason): SessionSummaryState | null => {
      const activeSession = activeSessionRef.current;
      if (!activeSession) return null;

      if (activeSession.role === "spectator") {
        return null;
      }

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
