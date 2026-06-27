import type { Express } from "express";

import type { RoomStore } from "./roomStore";

/**
 * 공개 방 목록 관련 REST 라우트를 등록한다.
 * - `GET /api/rooms` — guest 없는 공개 대기실 목록
 * - `GET /api/rooms/playing` — 플레이 중인 관전 가능 방 목록
 * @param app - Express 앱 인스턴스
 * @param roomStore - 방 저장소 인스턴스
 */
export function registerPublicRoomRoutes(app: Express, roomStore: RoomStore) {
  app.get("/api/rooms", (_req, res) => {
    res.json(roomStore.listPublicRooms());
  });

  app.get("/api/rooms/playing", (_req, res) => {
    res.json(roomStore.listPlayingPublicRooms());
  });
}
