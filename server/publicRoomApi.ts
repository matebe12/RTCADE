import type { Express } from "express";

import type { RoomStore } from "./roomStore";

export function registerPublicRoomRoutes(app: Express, roomStore: RoomStore) {
  app.get("/api/rooms", (_req, res) => {
    res.json(roomStore.listPublicRooms());
  });
}
