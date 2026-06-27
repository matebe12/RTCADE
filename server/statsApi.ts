import type { Express } from "express";

import type { OperationsDatabase } from "./operationsDatabase";
import type { PlaySessionStore } from "./playSessionStore";
import type { RoomStore } from "./roomStore";

function isNonEmptyString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0;
}

function getQueryString(value: unknown) {
  if (typeof value === "string") {
    return value;
  }

  if (Array.isArray(value)) {
    const firstString = value.find((entry) => typeof entry === "string");
    return typeof firstString === "string" ? firstString : "";
  }

  return "";
}

/**
 * 통계 조회/기록 REST 라우트를 등록한다.
 * - `GET /api/stats` — 방문자 수, 방 수, 솔로 세션 수, 게임 지표 집계
 * - `POST /api/game-sessions` — 게임 세션 기록
 * - `POST /api/active-play-sessions` — 아쿟티브 좄로 세션 upsert
 * - `DELETE /api/active-play-sessions/:id` — 쉄로 세션 명시 종료
 * @param app - Express 앱 인스턴스
 * @param roomStore - 방 저장소
 * @param playSessionStore - 아쿟티브 솔로 세션 저장소
 * @param db - DB 인터페이스
 */
export function registerStatsRoutes(
  app: Express,
  operationsDatabase: OperationsDatabase,
  roomStore: RoomStore,
  playSessionStore: PlaySessionStore,
) {
  app.post("/api/game-sessions", async (req, res) => {
    const { core, gameName, romPath, sessionId } = req.body ?? {};

    if (
      !isNonEmptyString(core) ||
      !isNonEmptyString(gameName) ||
      !isNonEmptyString(romPath) ||
      !isNonEmptyString(sessionId)
    ) {
      res.status(400).json({ ok: false });
      return;
    }

    await operationsDatabase.recordGameSession({
      core: core.trim(),
      gameName: gameName.trim(),
      romPath: romPath.trim(),
      sessionId: sessionId.trim(),
    });

    res.status(202).json({ ok: true });
  });

  app.post("/api/game-sessions/:sessionId/end", async (req, res) => {
    const sessionId = req.params.sessionId ?? "";

    if (!isNonEmptyString(sessionId)) {
      res.status(400).json({ ok: false });
      return;
    }

    await operationsDatabase.completeGameSession(sessionId.trim());
    res.status(202).json({ ok: true });
  });

  app.post("/api/active-play-sessions", (req, res) => {
    const { core, gameName, mode, romPath, sessionId } = req.body ?? {};
    const visitorId = getQueryString(req.query.visitorId);

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

  app.post("/api/active-play-sessions/:sessionId/end", (req, res) => {
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
