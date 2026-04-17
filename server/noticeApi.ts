import type { Express } from "express";

import type { OperationsDatabase } from "./operationsDatabase";

export function registerNoticeRoutes(app: Express, operationsDatabase: OperationsDatabase) {
  app.get("/api/notices", async (_req, res) => {
    const notices = await operationsDatabase.listNotices();
    res.json({ items: notices });
  });
}
