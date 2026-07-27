import { WebSocket, WebSocketServer } from "ws";

import type { RawData } from "ws";

import type { Room, RoomStore } from "./roomStore";

/** 서버 → 클라이언트 WebSocket 핑 주기 (ms). 연결 유지에 사용된다. */
const WS_PING_INTERVAL_MS = 30_000;

type ClientRole = "host" | "guest" | "spectator" | null;

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

function getRomFilename(romPath: string) {
  return romPath.split("/").pop() ?? romPath;
}

function broadcastRoomLobby(room: Room, roomStore: RoomStore) {
  const message = {
    type: "room-lobby-updated",
    ...roomStore.getLobbySnapshot(room),
  };

  send(room.host, message);

  if (room.guest) {
    send(room.guest.socket, message);
  }

  for (const spectator of room.spectators.values()) {
    send(spectator.socket, message);
  }
}

/**
 * WebSocket 서버를 Express 프로세스에 연결하여 시그널링을 시작한다.
 * offer/answer/ice-candidate 메시지를 중계하고, 방 라이프사이클을 관리한다.
 * @param wss - ws.WebSocketServer 인스턴스
 * @param roomStore - 방 저장소 인스턴스
 */
export function attachSignalingServer(wss: WebSocketServer, roomStore: RoomStore) {
  const kickedSockets = new WeakSet<WebSocket>();

  wss.on("connection", (ws) => {
    let myRoom: Room | null = null;
    let role: ClientRole = null;
    let spectatorId: string | null = null;
    let alive = true;

    // Periodic ping to keep the connection alive through Railway/nginx proxies.
    const pingTimer = setInterval(() => {
      if (!alive) {
        ws.terminate();
        return;
      }
      alive = false;
      ws.ping();
    }, WS_PING_INTERVAL_MS);

    ws.on("pong", () => {
      alive = true;
    });

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
          broadcastRoomLobby(room, roomStore);
          break;
        }

        case "join-room": {
          const room = roomStore.findRoom(String(message.code));

          if (!room) {
            send(ws, { type: "error", message: "방을 찾을 수 없습니다." });
            return;
          }

          if (room.state !== "waiting") {
            send(ws, { type: "error", message: "이미 플레이 중인 방입니다." });
            return;
          }

          if (
            !roomStore.attachGuest(room, ws, {
              nickname: message.nickname ? String(message.nickname) : undefined,
              avatar: message.avatar ? String(message.avatar) : undefined,
            })
          ) {
            send(ws, { type: "error", message: "방이 이미 가득 찼습니다." });
            return;
          }

          myRoom = room;
          role = "guest";

          send(ws, {
            type: "room-joined",
            code: room.code,
            participantId: "guest",
            role: "guest",
            romFilename: getRomFilename(room.romFilename),
            romPath: room.romFilename,
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
          broadcastRoomLobby(room, roomStore);
          break;
        }

        case "spectate-room": {
          const room = roomStore.findRoom(String(message.code));

          if (!room) {
            send(ws, { type: "error", message: "방을 찾을 수 없습니다." });
            return;
          }

          const attachedSpectator = roomStore.attachSpectator(room, ws, {
            nickname: message.nickname ? String(message.nickname) : undefined,
            avatar: message.avatar ? String(message.avatar) : undefined,
          });

          if (!attachedSpectator) {
            send(ws, { type: "error", message: "관전자 정원이 가득 찼습니다." });
            return;
          }

          myRoom = room;
          role = "spectator";
          spectatorId = attachedSpectator.id;

          send(ws, {
            type: "room-joined",
            code: room.code,
            participantId: attachedSpectator.id,
            role: "spectator",
            romFilename: getRomFilename(room.romFilename),
            romPath: room.romFilename,
            core: room.core,
            bios: room.bios,
            hostNickname: room.hostNickname,
            hostAvatar: room.hostAvatar,
          });

          send(room.host, {
            type: "spectator-joined",
            spectatorId: attachedSpectator.id,
            spectatorNickname: attachedSpectator.nickname,
            spectatorAvatar: attachedSpectator.avatar,
            spectatorCount: roomStore.getSpectatorCount(room),
          });
          broadcastRoomLobby(room, roomStore);
          break;
        }

        case "set-room-ready": {
          if (!myRoom || myRoom.state !== "waiting") {
            return;
          }

          if (role !== "guest" && role !== "spectator") {
            return;
          }

          roomStore.setParticipantReady(myRoom, ws, !!message.ready);
          broadcastRoomLobby(myRoom, roomStore);
          break;
        }

        case "update-room-game": {
          if (!myRoom || myRoom.state !== "waiting" || role !== "host") {
            return;
          }

          const romPath = typeof message.romPath === "string" ? String(message.romPath) : "";

          if (!romPath) {
            send(ws, { type: "error", message: "변경할 게임 정보를 확인하지 못했습니다." });
            return;
          }

          roomStore.updateRoomGame(myRoom, {
            romPath,
            core: String(message.core || "nes"),
            bios: message.bios ? String(message.bios) : undefined,
          });
          broadcastRoomLobby(myRoom, roomStore);
          break;
        }

        case "kick-room-participant": {
          if (!myRoom || myRoom.state !== "waiting" || role !== "host") {
            return;
          }

          const participantId =
            typeof message.participantId === "string" ? String(message.participantId) : null;

          if (!participantId || participantId === "host") {
            return;
          }

          let target: WebSocket | null = null;

          if (participantId === "guest" && myRoom.guest) {
            target = myRoom.guest.socket;
            roomStore.detachGuest(myRoom);
          } else {
            target = roomStore.findSpectatorSocket(myRoom, participantId);
            if (target) {
              roomStore.detachSpectator(myRoom, participantId);
            }
          }

          if (!target) {
            send(ws, { type: "error", message: "해당 참가자를 찾을 수 없습니다." });
            return;
          }

          kickedSockets.add(target);
          send(target, {
            type: "room-kicked",
            message: "방장이 대기실에서 내보냈습니다. 다시 참여하려면 방에 재입장해 주세요.",
          });
          broadcastRoomLobby(myRoom, roomStore);
          break;
        }

        case "session-started": {
          if (role === "host" && myRoom) {
            if (!roomStore.markPlaying(myRoom)) {
              send(ws, {
                type: "error",
                message: "게스트가 들어오고, 모든 관전자가 준비 완료되어야 시작할 수 있습니다.",
              });
              broadcastRoomLobby(myRoom, roomStore);
              return;
            }

            send(myRoom.host, {
              type: "room-session-started",
              code: myRoom.code,
              role: "host",
              romFilename: getRomFilename(myRoom.romFilename),
              romPath: myRoom.romFilename,
              core: myRoom.core,
              bios: myRoom.bios,
              hostNickname: myRoom.hostNickname,
              hostAvatar: myRoom.hostAvatar,
            });

            if (myRoom.guest) {
              send(myRoom.guest.socket, {
                type: "room-session-started",
                code: myRoom.code,
                role: "guest",
                romFilename: getRomFilename(myRoom.romFilename),
                romPath: myRoom.romFilename,
                core: myRoom.core,
                bios: myRoom.bios,
                hostNickname: myRoom.hostNickname,
                hostAvatar: myRoom.hostAvatar,
              });
            }

            for (const spectator of myRoom.spectators.values()) {
              send(spectator.socket, {
                type: "room-session-started",
                code: myRoom.code,
                role: "spectator",
                romFilename: getRomFilename(myRoom.romFilename),
                romPath: myRoom.romFilename,
                core: myRoom.core,
                bios: myRoom.bios,
                hostNickname: myRoom.hostNickname,
                hostAvatar: myRoom.hostAvatar,
              });
            }
          }
          break;
        }

        case "offer":
        case "answer":
        case "ice-candidate": {
          if (!myRoom) {
            return;
          }

          let target: WebSocket | null = null;

          if (role === "host") {
            const targetSpectatorId =
              typeof message.spectatorId === "string" ? String(message.spectatorId) : null;
            target = targetSpectatorId
              ? roomStore.findSpectatorSocket(myRoom, targetSpectatorId)
              : myRoom.guest?.socket ?? null;
          } else if (role === "guest") {
            target = myRoom.host;
          } else if (role === "spectator") {
            target = myRoom.host;
          }

          if (target) {
            if (role === "spectator" && spectatorId) {
              send(target, { ...message, spectatorId });
              return;
            }

            send(target, message);
          }
          break;
        }
      }
    });

    ws.on("close", () => {
      clearInterval(pingTimer);

      if (!myRoom) {
        return;
      }

      if (kickedSockets.has(ws)) {
        kickedSockets.delete(ws);
        return;
      }

      if (role === "host") {
        if (myRoom.guest) {
          send(myRoom.guest.socket, { type: "peer-disconnected" });
        }
        for (const hostedSpectator of myRoom.spectators.values()) {
          send(hostedSpectator.socket, { type: "peer-disconnected" });
        }
        roomStore.deleteRoom(myRoom.code);
        return;
      }

      if (role === "guest") {
        if (myRoom.state === "playing") {
          for (const hostedSpectator of roomStore.endPlayingSession(myRoom)) {
            send(hostedSpectator.socket, { type: "peer-disconnected" });
          }
          send(myRoom.host, { type: "peer-disconnected" });
        } else {
          roomStore.detachGuest(myRoom);
          broadcastRoomLobby(myRoom, roomStore);
        }
        return;
      }

      if (role === "spectator" && spectatorId) {
        roomStore.detachSpectator(myRoom, spectatorId);
        if (myRoom.state === "playing") {
          send(myRoom.host, {
            type: "spectator-disconnected",
            spectatorId,
            spectatorCount: roomStore.getSpectatorCount(myRoom),
          });
        } else {
          broadcastRoomLobby(myRoom, roomStore);
        }
      }
    });
  });
}
