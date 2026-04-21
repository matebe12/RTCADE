import { randomUUID } from "node:crypto";

import type { WebSocket } from "ws";

import { MAX_SPECTATORS_PER_ROOM } from "../shared/emulator-protocol";

export type RoomState = "waiting" | "playing";

export interface RoomSpectator {
  id: string;
  socket: WebSocket;
  nickname?: string;
  avatar?: string;
  joinedAt: number;
}

export interface Room {
  code: string;
  host: WebSocket;
  guest: WebSocket | null;
  romFilename: string;
  core: string;
  bios?: string;
  isPublic: boolean;
  createdAt: number;
  hostNickname?: string;
  hostAvatar?: string;
  startedAt: number | null;
  state: RoomState;
  spectators: Map<string, RoomSpectator>;
}

export interface PublicRoomSummary {
  code: string;
  romPath: string;
  core: string;
  bios?: string;
  createdAt: number;
  hostNickname?: string;
  hostAvatar?: string;
}

export interface PlayingRoomSummary extends PublicRoomSummary {
  startedAt: number;
  spectatorCount: number;
}

export interface RoomActivitySnapshot {
  activeRooms: number;
  connectedPlayers: number;
  openRooms: number;
  spectatorCount: number;
  waitingRooms: number;
}

interface CreateRoomOptions {
  host: WebSocket;
  romFilename: string;
  core: string;
  bios?: string;
  isPublic: boolean;
  hostNickname?: string;
  hostAvatar?: string;
}

export interface RoomStore {
  attachGuest: (room: Room, guest: WebSocket) => boolean;
  attachSpectator: (
    room: Room,
    spectator: WebSocket,
    options?: { nickname?: string; avatar?: string },
  ) => RoomSpectator | null;
  createRoom: (options: CreateRoomOptions) => Room;
  deleteRoom: (code: string) => void;
  detachGuest: (room: Room) => void;
  detachSpectator: (room: Room, spectatorId: string) => boolean;
  endPlayingSession: (room: Room) => RoomSpectator[];
  findRoom: (code: string) => Room | null;
  findSpectatorSocket: (room: Room, spectatorId: string) => WebSocket | null;
  getActivitySnapshot: () => RoomActivitySnapshot;
  getSpectatorCount: (room: Room) => number;
  listPlayingPublicRooms: () => PlayingRoomSummary[];
  listPublicRooms: () => PublicRoomSummary[];
  markPlaying: (room: Room) => boolean;
}

function generateCode(rooms: Map<string, Room>): string {
  let code: string;

  do {
    code = String(Math.floor(100000 + Math.random() * 900000));
  } while (rooms.has(code));

  return code;
}

function clearSpectators(room: Room) {
  const spectators = Array.from(room.spectators.values());
  room.spectators.clear();
  return spectators;
}

export function createRoomStore(): RoomStore {
  const rooms = new Map<string, Room>();

  return {
    attachGuest: (room, guest) => {
      if (room.guest) {
        return false;
      }

      room.guest = guest;
      return true;
    },
    attachSpectator: (room, spectator, options) => {
      if (room.state !== "playing") {
        return null;
      }

      if (room.spectators.size >= MAX_SPECTATORS_PER_ROOM) {
        return null;
      }

      for (const existingSpectator of room.spectators.values()) {
        if (existingSpectator.socket === spectator) {
          return existingSpectator;
        }
      }

      const roomSpectator: RoomSpectator = {
        id: randomUUID(),
        socket: spectator,
        nickname: options?.nickname,
        avatar: options?.avatar,
        joinedAt: Date.now(),
      };

      room.spectators.set(roomSpectator.id, roomSpectator);
      return roomSpectator;
    },
    createRoom: ({ host, romFilename, core, bios, isPublic, hostNickname, hostAvatar }) => {
      const room: Room = {
        code: generateCode(rooms),
        host,
        guest: null,
        romFilename,
        core,
        bios,
        isPublic,
        createdAt: Date.now(),
        hostNickname,
        hostAvatar,
        startedAt: null,
        state: "waiting",
        spectators: new Map(),
      };

      rooms.set(room.code, room);
      return room;
    },
    deleteRoom: (code) => {
      rooms.delete(code);
    },
    detachGuest: (room) => {
      room.guest = null;
      room.state = "waiting";
      room.startedAt = null;
      room.spectators.clear();
    },
    detachSpectator: (room, spectatorId) => room.spectators.delete(spectatorId),
    endPlayingSession: (room) => {
      room.guest = null;
      room.state = "waiting";
      room.startedAt = null;
      return clearSpectators(room);
    },
    findRoom: (code) => rooms.get(code) ?? null,
    findSpectatorSocket: (room, spectatorId) => room.spectators.get(spectatorId)?.socket ?? null,
    getActivitySnapshot: () => {
      let waitingRooms = 0;
      let activeRooms = 0;
      let connectedPlayers = 0;
      let spectatorCount = 0;

      for (const room of rooms.values()) {
        spectatorCount += room.spectators.size;
        connectedPlayers += room.guest ? 2 : 1;
        connectedPlayers += room.spectators.size;

        if (room.state === "playing") {
          activeRooms += 1;
        } else {
          waitingRooms += 1;
        }
      }

      return {
        activeRooms,
        connectedPlayers,
        openRooms: rooms.size,
        spectatorCount,
        waitingRooms,
      };
    },
    getSpectatorCount: (room) => room.spectators.size,
    listPlayingPublicRooms: () =>
      Array.from(rooms.values())
        .filter((room) => room.isPublic && room.state === "playing" && room.startedAt !== null)
        .sort(
          (left, right) =>
            (right.startedAt ?? right.createdAt) - (left.startedAt ?? left.createdAt),
        )
        .map((room) => ({
          code: room.code,
          romPath: room.romFilename,
          core: room.core,
          bios: room.bios,
          createdAt: room.createdAt,
          hostNickname: room.hostNickname,
          hostAvatar: room.hostAvatar,
          startedAt: room.startedAt ?? room.createdAt,
          spectatorCount: room.spectators.size,
        })),
    listPublicRooms: () =>
      Array.from(rooms.values())
        .filter((room) => room.isPublic && room.guest === null && room.state === "waiting")
        .sort((left, right) => right.createdAt - left.createdAt)
        .map((room) => ({
          code: room.code,
          romPath: room.romFilename,
          core: room.core,
          bios: room.bios,
          createdAt: room.createdAt,
          hostNickname: room.hostNickname,
          hostAvatar: room.hostAvatar,
        })),
    markPlaying: (room) => {
      if (!room.guest) {
        return false;
      }

      room.state = "playing";
      room.startedAt = room.startedAt ?? Date.now();
      return true;
    },
  };
}
