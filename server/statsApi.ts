import type { Express } from "express";

import type { OperationsDatabase } from "./operationsDatabase";
import type { RoomStore } from "./roomStore";

function isNonEmptyString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0;
}

export function registerStatsRoutes(
  app: Express,
  operationsDatabase: OperationsDatabase,
  roomStore: RoomStore,
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

  app.get("/api/stats", async (_req, res) => {
    const visitorCounts = await operationsDatabase.getVisitorCounts();
    const gameMetrics = await operationsDatabase.getGameMetrics();
    const roomActivity = roomStore.getActivitySnapshot();

    res.json({
      ...visitorCounts,
      ...gameMetrics,
      ...roomActivity,
      dbEnabled: operationsDatabase.isEnabled,
    });
  });
}
