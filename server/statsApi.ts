import type { Express } from "express";

import type { OperationsDatabase } from "./operationsDatabase";
import type { PlaySessionStore } from "./playSessionStore";
import type { RoomStore } from "./roomStore";

function isNonEmptyString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0;
}

export function registerStatsRoutes(
  app: Express,
  operationsDatabase: OperationsDatabase,
  roomStore: RoomStore,
  playSessionStore: PlaySessionStore,
) {
  app.post("/api/game-sessions", async (req, res) => {
    const { core, gameName, romPath } = req.body ?? {};

    if (!isNonEmptyString(core) || !isNonEmptyString(gameName) || !isNonEmptyString(romPath)) {
      res.status(400).json({ ok: false });
      return;
    }

    await operationsDatabase.recordGameSession({
      core: core.trim(),
      gameName: gameName.trim(),
      romPath: romPath.trim(),
    });

    res.status(202).json({ ok: true });
  });

  app.post("/api/active-play-sessions", (req, res) => {
    const { core, gameName, mode, romPath, sessionId } = req.body ?? {};
    const visitorId = req.query.visitorId;

    if (
      !isNonEmptyString(core) ||
      !isNonEmptyString(gameName) ||
      !isNonEmptyString(romPath) ||
      !isNonEmptyString(sessionId) ||
      !isNonEmptyString(visitorId) ||
      mode !== "solo"
    ) {
      res.status(400).json({ ok: false });
      return;
    }

    playSessionStore.upsertSession({
      core: core.trim(),
      gameName: gameName.trim(),
      mode,
      romPath: romPath.trim(),
      sessionId: sessionId.trim(),
      visitorId: visitorId.trim(),
    });

    res.status(202).json({ ok: true });
  });

  app.delete("/api/active-play-sessions/:sessionId", (req, res) => {
    playSessionStore.endSession(req.params.sessionId ?? "");
    res.status(202).json({ ok: true });
  });

  app.get("/api/stats", async (_req, res) => {
    const visitorCounts = await operationsDatabase.getVisitorCounts();
    const gameMetrics = await operationsDatabase.getGameMetrics();
    const roomActivity = roomStore.getActivitySnapshot();
    const playActivity = playSessionStore.getActivitySnapshot();
    const activeNetplayRooms = roomActivity.activeRooms;
    const soloSessions = playActivity.soloSessions;

    res.json({
      ...visitorCounts,
      ...gameMetrics,
      ...roomActivity,
      activeNetplayRooms,
      activeRooms: activeNetplayRooms + soloSessions,
      connectedPlayers: roomActivity.connectedPlayers + soloSessions,
      dbEnabled: operationsDatabase.isEnabled,
      soloSessions,
    });
  });
}
