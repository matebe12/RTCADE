import type { WebSocket } from "ws";

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
  createRoom: (options: CreateRoomOptions) => Room;
  deleteRoom: (code: string) => void;
  detachGuest: (room: Room) => void;
  findRoom: (code: string) => Room | null;
  listPublicRooms: () => PublicRoomSummary[];
}

function generateCode(rooms: Map<string, Room>): string {
  let code: string;

  do {
    code = String(Math.floor(100000 + Math.random() * 900000));
  } while (rooms.has(code));

  return code;
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
      };

      rooms.set(room.code, room);
      return room;
    },
    deleteRoom: (code) => {
      rooms.delete(code);
    },
    detachGuest: (room) => {
      room.guest = null;
    },
    findRoom: (code) => rooms.get(code) ?? null,
    listPublicRooms: () =>
      Array.from(rooms.values())
        .filter((room) => room.isPublic && room.guest === null)
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
  };
}