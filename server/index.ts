import express from "express";
import { createServer } from "http";
import { WebSocketServer } from "ws";

import { createCorsMiddleware, getServerConfig } from "./config";
import { registerEmulatorRoute } from "./emulator";
import { registerPublicRoomRoutes } from "./publicRoomApi";
import { registerRomRoutes } from "./romApi";
import { createRoomStore } from "./roomStore";
import { attachSignalingServer } from "./signaling";

const config = getServerConfig();
const roomStore = createRoomStore();
const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

app.use(createCorsMiddleware(config.allowedOrigins));
registerRomRoutes(app, config.romsDir);
registerEmulatorRoute(app);
registerPublicRoomRoutes(app, roomStore);
attachSignalingServer(wss, roomStore);

server.listen(config.port, "0.0.0.0", () => {
  console.log(`Server running on http://0.0.0.0:${config.port}`);
  console.log(`ROM directory: ${config.romsDir}`);
  console.log(`Put ROM files in server/roms/ to serve them.`);
});
