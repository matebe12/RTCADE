import type { Express } from "express";

import type { IceServerDefinition } from "./config";

export function registerIceServerRoutes(app: Express, iceServers: IceServerDefinition[]) {
  app.get("/api/ice-servers", (_req, res) => {
    res.json({ iceServers });
  });
}