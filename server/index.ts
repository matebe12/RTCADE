import * as Sentry from "@sentry/node";
import express from "express";
import { createServer } from "http";
import { WebSocketServer } from "ws";

import { createCorsMiddleware, getServerConfig } from "./config";
import { createOperationsDatabase } from "./operationsDatabase";
import { registerIceServerRoutes } from "./iceServerApi";
import { registerNoticeRoutes } from "./noticeApi";
import { createPlaySessionStore } from "./playSessionStore";
import { registerPublicRoomRoutes } from "./publicRoomApi";
import { registerRomRoutes } from "./romApi";
import { createRoomStore } from "./roomStore";
import { attachSignalingServer } from "./signaling";
import { registerStatsRoutes } from "./statsApi";
import { createVisitorTrackingMiddleware } from "./visitorTracking";

async function bootstrap() {
  const config = getServerConfig();

  if (config.sentryDsn) {
    Sentry.init({
      dsn: config.sentryDsn,
      environment: process.env.NODE_ENV || "development",
      integrations: [Sentry.expressIntegration(), Sentry.httpIntegration()],
      tracesSampleRate: 0.2,
    });
  }

  const roomStore = createRoomStore();
  const operationsDatabase = createOperationsDatabase(config.databaseUrl);
  const playSessionStore = createPlaySessionStore({
    onSessionEnded: (session, reason) => {
      const endedAt = reason === "expired" ? new Date(session.lastSeenAt).toISOString() : undefined;
      void operationsDatabase.completeGameSession(session.sessionId, endedAt);
    },
  });
  const app = express();
  const server = createServer(app);
  const wss = new WebSocketServer({ server });

  await operationsDatabase.initialize();

  // 이전 서버 인스턴스가 남긴 미완료 게임 세션 정리 (서버 재시작 시나리오)
  await operationsDatabase.closeStaleGameSessions();

  const stopPruneInterval = playSessionStore.startPruneInterval();

  app.use(express.json());
  app.use(createCorsMiddleware(config.allowedOrigins));
  app.use(createVisitorTrackingMiddleware(operationsDatabase));
  registerRomRoutes(app, config.romsDir);
  registerIceServerRoutes(app, config.iceServers);
  registerPublicRoomRoutes(app, roomStore);
  registerNoticeRoutes(app, operationsDatabase, config.noticeAdminToken);
  registerStatsRoutes(app, operationsDatabase, roomStore, playSessionStore);
  attachSignalingServer(wss, roomStore);

  // Sentry 에러 핸들러는 모든 라우트 등록 이후에 추가해야 한다.
  if (config.sentryDsn) {
    Sentry.setupExpressErrorHandler(app);
  }

  let isShuttingDown = false;

  const shutdown = (signal: NodeJS.Signals) => {
    if (isShuttingDown) {
      return;
    }

    isShuttingDown = true;
    console.log(`[Server] Received ${signal}, shutting down gracefully...`);

    stopPruneInterval();
    wss.close();
    server.close(() => {
      console.log("[Server] HTTP server closed.");
      process.exit(0);
    });

    setTimeout(() => {
      console.error("[Server] Graceful shutdown timed out. Forcing exit.");
      process.exit(1);
    }, 10_000).unref();
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));

  server.listen(config.port, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${config.port}`);
    console.log(`ROM directory: ${config.romsDir}`);
    console.log(`Operations DB: ${operationsDatabase.isEnabled ? "enabled" : "disabled"}`);
    console.log("Put ROM files in server/roms/ to serve them.");
  });
}

void bootstrap();
