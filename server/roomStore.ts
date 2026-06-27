import { randomUUID } from "node:crypto";

import type { WebSocket } from "ws";

import { MAX_SPECTATORS_PER_ROOM } from "../shared/emulator-protocol";

/** 방 상태. `waiting`은 대기 중, `playing`은 게임 진행 중. */
export type RoomState = "waiting" | "playing";

/** 대기실 코드에서 한 참가자 요약 정보. */
export interface RoomLobbyParticipantSummary {
  id: string;
  role: "host" | "guest" | "spectator";
  nickname?: string;
  avatar?: string;
  ready: boolean;
  joinedAt: number;
}

/** 대기실 스냅샷. 순참자들에게 주기적으로 broadcast할 때 사용된다. */
export interface RoomLobbySnapshot {
  code: string;
  roomState: RoomState;
  romFilename: string;
  romPath: string;
  core: string;
  bios?: string;
  isPublic: boolean;
  participants: RoomLobbyParticipantSummary[];
  canStart: boolean;
  hasGuest: boolean;
  spectatorSlotsRemaining: number;
  roleLocked: boolean;
}

/** 방에 입장한 GUEST 정보. */
export interface RoomGuest {
  socket: WebSocket;
  nickname?: string;
  avatar?: string;
  ready: boolean;
  joinedAt: number;
}

/** 방에 들어온 관전자 정보. */
export interface RoomSpectator {
  id: string;
  socket: WebSocket;
  nickname?: string;
  avatar?: string;
  ready: boolean;
  joinedAt: number;
}

/** 서버 메모리에 저장되는 단일 방 데이터. */
export interface Room {
  code: string;
  host: WebSocket;
  guest: RoomGuest | null;
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

/** 공개 방 목록 API 응답에 포함되는 요약. */
export interface PublicRoomSummary {
  code: string;
  romPath: string;
  core: string;
  bios?: string;
  createdAt: number;
  hostNickname?: string;
  hostAvatar?: string;
}

/** 플레이 중인 관전 가능 방 목록 API 응답에 포함되는 요약. */
export interface PlayingRoomSummary extends PublicRoomSummary {
  startedAt: number;
  spectatorCount: number;
}

/** `/api/stats` 에서 사용되는 방 활동 요약. */
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

/**
 * 모든 방 상태를 메모리에 저장하는 방 저장소 인터페이스.
 * signaling.ts와 라우트 모듈에서 공유한다.
 */
export interface RoomStore {
  attachGuest: (
    room: Room,
    guest: WebSocket,
    options?: { nickname?: string; avatar?: string },
  ) => boolean;
  attachSpectator: (
    room: Room,
    spectator: WebSocket,
    options?: { nickname?: string; avatar?: string },
  ) => RoomSpectator | null;
  canStartSession: (room: Room) => boolean;
  createRoom: (options: CreateRoomOptions) => Room;
  deleteRoom: (code: string) => void;
  detachGuest: (room: Room) => void;
  detachSpectator: (room: Room, spectatorId: string) => boolean;
  endPlayingSession: (room: Room) => RoomSpectator[];
  findRoom: (code: string) => Room | null;
  findSpectatorSocket: (room: Room, spectatorId: string) => WebSocket | null;
  getActivitySnapshot: () => RoomActivitySnapshot;
  getLobbySnapshot: (room: Room) => RoomLobbySnapshot;
  getSpectatorCount: (room: Room) => number;
  listPlayingPublicRooms: () => PlayingRoomSummary[];
  listPublicRooms: () => PublicRoomSummary[];
  markPlaying: (room: Room) => boolean;
  setParticipantReady: (room: Room, socket: WebSocket, ready: boolean) => boolean;
  updateRoomGame: (room: Room, options: { romPath: string; core: string; bios?: string }) => boolean;
}

/** 중복되지 않는 6자리 방 코드를 생성한다. */
function generateCode(rooms: Map<string, Room>): string {
  let code: string;

  do {
    code = String(Math.floor(100000 + Math.random() * 900000));
  } while (rooms.has(code));

  return code;
}

/** 방의 관전자 Map을 비우고 제거된 관전자 배열을 반환한다. */
function clearSpectators(room: Room) {
  const spectators = Array.from(room.spectators.values());
  room.spectators.clear();
  return spectators;
}

/** ROM 경로에서 파일명만 추출한다. */
function getRomFilename(romPath: string) {
  return romPath.split("/").pop() ?? romPath;
}

/** guest와 모든 관전자가 ready 상태일 때 `true`를 반환한다. */
function canStartRoomSession(room: Room) {
  return room.guest !== null && room.guest.ready && Array.from(room.spectators.values()).every((spectator) => spectator.ready);
}

/** 대기실 코드에 표시할 참가자 목록을 구성한다. host는 항상 첫 번째. */
function buildLobbyParticipants(room: Room): RoomLobbyParticipantSummary[] {
  const participants: RoomLobbyParticipantSummary[] = [
    {
      id: "host",
      role: "host",
      nickname: room.hostNickname,
      avatar: room.hostAvatar,
      ready: true,
      joinedAt: room.createdAt,
    },
  ];

  if (room.guest) {
    participants.push({
      id: "guest",
      role: "guest",
      nickname: room.guest.nickname,
      avatar: room.guest.avatar,
      ready: room.guest.ready,
      joinedAt: room.guest.joinedAt,
    });
  }

  participants.push(
    ...Array.from(room.spectators.values())
      .sort((left, right) => left.joinedAt - right.joinedAt)
      .map((spectator) => ({
        id: spectator.id,
        role: "spectator" as const,
        nickname: spectator.nickname,
        avatar: spectator.avatar,
        ready: spectator.ready,
        joinedAt: spectator.joinedAt,
      })),
  );

  return participants;
}

/**
 * 모든 방 상태를 메모리에 저장하는 저장소를 생성한다.
 * 서버 재시작 시 모든 데이터는 소멸된다.
 * @returns {@link RoomStore} 인터페이스 구현체
 */
export function createRoomStore(): RoomStore {
  const rooms = new Map<string, Room>();

  return {
    attachGuest: (room, guest, options) => {
      if (room.guest) {
        return false;
      }

      room.guest = {
        socket: guest,
        nickname: options?.nickname,
        avatar: options?.avatar,
        ready: false,
        joinedAt: Date.now(),
      };
      return true;
    },
    attachSpectator: (room, spectator, options) => {
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
        ready: false,
        joinedAt: Date.now(),
      };

      room.spectators.set(roomSpectator.id, roomSpectator);
      return roomSpectator;
    },
    canStartSession: (room) => canStartRoomSession(room),
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
    getLobbySnapshot: (room) => ({
      code: room.code,
      roomState: room.state,
      romFilename: getRomFilename(room.romFilename),
      romPath: room.romFilename,
      core: room.core,
      bios: room.bios,
      isPublic: room.isPublic,
      participants: buildLobbyParticipants(room),
      canStart: canStartRoomSession(room),
      hasGuest: room.guest !== null,
      spectatorSlotsRemaining: Math.max(0, MAX_SPECTATORS_PER_ROOM - room.spectators.size),
      roleLocked: room.state === "playing",
    }),
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
      if (!canStartRoomSession(room)) {
        return false;
      }

      room.state = "playing";
      room.startedAt = room.startedAt ?? Date.now();
      return true;
    },
    setParticipantReady: (room, socket, ready) => {
      if (room.guest?.socket === socket) {
        room.guest.ready = ready;
        return true;
      }

      for (const spectator of room.spectators.values()) {
        if (spectator.socket === socket) {
          spectator.ready = ready;
          return true;
        }
      }

      return false;
    },
    updateRoomGame: (room, options) => {
      if (room.state !== "waiting") {
        return false;
      }

      room.romFilename = options.romPath;
      room.core = options.core;
      room.bios = options.bios;

      if (room.guest) {
        room.guest.ready = false;
      }

      for (const spectator of room.spectators.values()) {
        spectator.ready = false;
      }

      return true;
    },
  };
}
