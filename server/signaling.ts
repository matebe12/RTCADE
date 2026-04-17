import type { RawData, WebSocket, WebSocketServer } from "ws";

import type { Room, RoomStore } from "./roomStore";

type ClientRole = "host" | "guest" | null;

function send(ws: WebSocket, data: unknown) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(data));
  }
}

function parseMessage(raw: RawData): Record<string, unknown> | null {
  try {
    return JSON.parse(String(raw)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function attachSignalingServer(wss: WebSocketServer, roomStore: RoomStore) {
  wss.on("connection", (ws) => {
    let myRoom: Room | null = null;
    let role: ClientRole = null;

    ws.on("message", (raw) => {
      const message = parseMessage(raw);
      if (!message || typeof message.type !== "string") {
        return;
      }

      switch (message.type) {
        case "create-room": {
          const room = roomStore.createRoom({
            host: ws,
            romFilename: String(message.romFilename || ""),
            core: String(message.core || "nes"),
            bios: message.bios ? String(message.bios) : undefined,
            isPublic: !!message.isPublic,
            hostNickname: message.nickname ? String(message.nickname) : undefined,
            hostAvatar: message.avatar ? String(message.avatar) : undefined,
          });

          myRoom = room;
          role = "host";
          send(ws, { type: "room-created", code: room.code });
          break;
        }

        case "join-room": {
          const room = roomStore.findRoom(String(message.code));

          if (!room) {
            send(ws, { type: "error", message: "방을 찾을 수 없습니다." });
            return;
          }

          if (!roomStore.attachGuest(room, ws)) {
            send(ws, { type: "error", message: "방이 이미 가득 찼습니다." });
            return;
          }

          myRoom = room;
          role = "guest";

          send(ws, {
            type: "room-joined",
            code: room.code,
            romFilename: room.romFilename,
            core: room.core,
            bios: room.bios,
            hostNickname: room.hostNickname,
            hostAvatar: room.hostAvatar,
          });

          send(room.host, {
            type: "guest-joined",
            guestNickname: message.nickname ? String(message.nickname) : undefined,
            guestAvatar: message.avatar ? String(message.avatar) : undefined,
          });
          break;
        }

        case "offer":
        case "answer":
        case "ice-candidate": {
          if (!myRoom) {
            return;
          }

          const target = role === "host" ? myRoom.guest : myRoom.host;
          if (target) {
            send(target, message);
          }
          break;
        }
      }
    });

    ws.on("close", () => {
      if (!myRoom) {
        return;
      }

      if (role === "host") {
        if (myRoom.guest) {
          send(myRoom.guest, { type: "peer-disconnected" });
        }
        roomStore.deleteRoom(myRoom.code);
        return;
      }

      if (role === "guest") {
        send(myRoom.host, { type: "peer-disconnected" });
        roomStore.detachGuest(myRoom);
      }
    });
  });
}