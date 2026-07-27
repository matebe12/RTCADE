type SessionMode = "solo";

/** 솔로 플레이 세션 데이터. TTL 기반 자동 만료가 지원된다. */
export interface ActivePlaySession {
  sessionId: string;
  visitorId: string;
  mode: SessionMode;
  gameName: string;
  romPath: string;
  core: string;
  startedAt: number;
  lastSeenAt: number;
}

/** `/api/stats`에서 사용되는 솔로 세션 활동 요약. */
export interface ActivePlaySnapshot {
  soloSessions: number;
}

interface UpsertPlaySessionInput {
  sessionId: string;
  visitorId: string;
  mode: SessionMode;
  gameName: string;
  romPath: string;
  core: string;
}

export interface PlaySessionStore {
  endSession: (sessionId: string) => void;
  getActivitySnapshot: () => ActivePlaySnapshot;
  upsertSession: (input: UpsertPlaySessionInput) => void;
  startPruneInterval: () => () => void;
}

/** 사든현안 안옥되면 TTL(30초) 초과 시 자동으로 만료첲리된다. */
const ACTIVE_SESSION_TTL_MS = 30_000;

interface CreatePlaySessionStoreOptions {
  onSessionEnded?: (session: ActivePlaySession, reason: "expired" | "explicit") => void;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

/**
 * 즔로 플레이 세션 저장소를 생성한다.
 * 세션은 TTL 기반 자동 만료되며, 명시적으로도 종료할 수 있다.
 * @param options.onSessionEnded - 세션이 종료될 때 호출되는 콜백
 * @returns {@link PlaySessionStore} 인터페이스 구현체
 */
export function createPlaySessionStore(options: CreatePlaySessionStoreOptions = {}): PlaySessionStore {
  const sessions = new Map<string, ActivePlaySession>();
  const notifySessionEnded = options.onSessionEnded;

  const pruneExpiredSessions = () => {
    const now = Date.now();

    for (const [sessionId, session] of sessions.entries()) {
      if (now - session.lastSeenAt > ACTIVE_SESSION_TTL_MS) {
        sessions.delete(sessionId);
        notifySessionEnded?.(session, "expired");
      }
    }
  };

  return {
    endSession: (sessionId) => {
      if (!isNonEmptyString(sessionId)) {
        return;
      }

      const normalizedSessionId = sessionId.trim();
      const endedSession = sessions.get(normalizedSessionId);
      sessions.delete(normalizedSessionId);
      if (endedSession) {
        notifySessionEnded?.(endedSession, "explicit");
      }
    },
    getActivitySnapshot: () => {
      pruneExpiredSessions();

      let soloSessions = 0;

      for (const session of sessions.values()) {
        if (session.mode === "solo") {
          soloSessions += 1;
        }
      }

      return {
        soloSessions,
      };
    },
    upsertSession: (input) => {
      if (
        !isNonEmptyString(input.sessionId) ||
        !isNonEmptyString(input.visitorId) ||
        !isNonEmptyString(input.gameName) ||
        !isNonEmptyString(input.romPath) ||
        !isNonEmptyString(input.core)
      ) {
        return;
      }

      pruneExpiredSessions();

      const nextSessionId = input.sessionId.trim();
      const existingSession = sessions.get(nextSessionId);
      const now = Date.now();

      sessions.set(nextSessionId, {
        sessionId: nextSessionId,
        visitorId: input.visitorId.trim(),
        mode: input.mode,
        gameName: input.gameName.trim(),
        romPath: input.romPath.trim(),
        core: input.core.trim(),
        startedAt: existingSession?.startedAt ?? now,
        lastSeenAt: now,
      });
    },
    startPruneInterval: () => {
      const intervalId = setInterval(pruneExpiredSessions, ACTIVE_SESSION_TTL_MS);
      return () => clearInterval(intervalId);
    },
  };
}
