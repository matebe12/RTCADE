type SessionMode = "solo";

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
}

const ACTIVE_SESSION_TTL_MS = 30_000;

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function createPlaySessionStore(): PlaySessionStore {
  const sessions = new Map<string, ActivePlaySession>();

  const pruneExpiredSessions = () => {
    const now = Date.now();

    for (const [sessionId, session] of sessions.entries()) {
      if (now - session.lastSeenAt > ACTIVE_SESSION_TTL_MS) {
        sessions.delete(sessionId);
      }
    }
  };

  return {
    endSession: (sessionId) => {
      if (!isNonEmptyString(sessionId)) {
        return;
      }

      sessions.delete(sessionId.trim());
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
  };
}
