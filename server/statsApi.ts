import type { Express } from "express";

import type { OperationsDatabase } from "./operationsDatabase";
import type { RoomStore } from "./roomStore";

export function registerStatsRoutes(
  app: Express,
  operationsDatabase: OperationsDatabase,
  roomStore: RoomStore,
) {
  app.get("/api/stats", async (_req, res) => {
    const visitorCounts = await operationsDatabase.getVisitorCounts();
    const roomActivity = roomStore.getActivitySnapshot();

    res.json({
      ...visitorCounts,
      ...roomActivity,
      dbEnabled: operationsDatabase.isEnabled,
    });
  });
}
