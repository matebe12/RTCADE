import express from "express";
import { createServer } from "http";
import { WebSocketServer } from "ws";

import { createCorsMiddleware, getServerConfig } from "./config";
import { createOperationsDatabase } from "./operationsDatabase";
import { registerEmulatorRoute } from "./emulator";
import { registerNoticeRoutes } from "./noticeApi";
import { registerPublicRoomRoutes } from "./publicRoomApi";
import { registerRomRoutes } from "./romApi";
import { createRoomStore } from "./roomStore";
import { attachSignalingServer } from "./signaling";
import { registerStatsRoutes } from "./statsApi";
import { createVisitorTrackingMiddleware } from "./visitorTracking";

async function bootstrap() {
  const config = getServerConfig();
  const roomStore = createRoomStore();
  const operationsDatabase = createOperationsDatabase(config.databaseUrl);
  const app = express();
  const server = createServer(app);
  const wss = new WebSocketServer({ server });

  await operationsDatabase.initialize();

  app.use(createCorsMiddleware(config.allowedOrigins));
  app.use(createVisitorTrackingMiddleware(operationsDatabase));
  registerRomRoutes(app, config.romsDir);
  registerEmulatorRoute(app);
  registerPublicRoomRoutes(app, roomStore);
  registerNoticeRoutes(app, operationsDatabase);
  registerStatsRoutes(app, operationsDatabase, roomStore);
  attachSignalingServer(wss, roomStore);

  server.listen(config.port, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${config.port}`);
    console.log(`ROM directory: ${config.romsDir}`);
    console.log(`Operations DB: ${operationsDatabase.isEnabled ? "enabled" : "disabled"}`);
    console.log("Put ROM files in server/roms/ to serve them.");
  });
}

void bootstrap();
