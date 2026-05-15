import { create } from "zustand";

import type { NetplayChatMessage } from "@/components/NetplayChatPanel";
import type { SystemCore } from "@/components/EmulatorPlayer";
import type { SessionEndReason } from "@/components/NetplaySessionSummary";
import {
  getFavoriteGames,
  getRecentGames,
  getRecentOpponents,
  type RecentGame,
  type RecentOpponent,
} from "@/lib/user-profile";
import type { NetplayNetworkStats } from "@/netplay/peer";
import type { NetplaySessionRole } from "../../shared/emulator-protocol";

const CHAT_MAX_MESSAGES = 100;

export interface RomInfo {
  filename: string;
  core: string;
  path: string;
  bios?: string;
}

export interface OpponentProfile {
  nickname: string;
  avatar: string;
}

export interface PublicRoomInfo {
  code: string;
  romPath: string;
  core: string;
  bios?: string;
  createdAt: number;
  hostNickname?: string;
  hostAvatar?: string;
}

export interface PlayingRoomInfo extends PublicRoomInfo {
  startedAt: number;
  spectatorCount: number;
}

export interface RoomLobbyParticipantInfo {
  id: string;
  role: "host" | "guest" | "spectator";
  nickname?: string;
  avatar?: string;
  ready: boolean;
  joinedAt: number;
}

export type LobbyMode = "netplay" | "solo";

export type RoomVisibility = "private" | "public";

export interface ActiveSession {
  mode: LobbyMode;
  romPath: string;
  core: SystemCore;
  role?: NetplaySessionRole;
  biosPath?: string;
  isPublic?: boolean;
}

export interface HostRoomConfig {
  romFilename: string;
  romPath: string;
  core: SystemCore;
  biosPath?: string;
  isPublic?: boolean;
}

export type SessionSummaryState = {
  step: "session-summary";
  mode: LobbyMode;
  romPath: string;
  core: SystemCore;
  role?: NetplaySessionRole;
  biosPath?: string;
  isPublic?: boolean;
  gameName: string;
  startedAt: number | null;
  endedAt: number;
  durationMs: number;
  endReason: SessionEndReason;
  opponentProfile: OpponentProfile | null;
};

export type LobbyState =
  | { step: "menu" }
  | { step: "browse"; roms: RomInfo[] }
  | { step: "solo-browse"; roms: RomInfo[] }
  | { step: "public-rooms"; rooms: PublicRoomInfo[] }
  | { step: "watch-rooms"; rooms: PlayingRoomInfo[] }
  | {
      step: "waiting";
      code: string;
      participantId: string;
      role: "host" | "guest" | "spectator";
      romFilename: string;
      romPath: string;
      core: SystemCore;
      biosPath?: string;
      isPublic?: boolean;
      participants: RoomLobbyParticipantInfo[];
      canStart: boolean;
      isReady: boolean;
      spectatorSlotsRemaining: number;
    }
  | { step: "join-input" }
  | { step: "spectate-input" }
  | {
      step: "playing";
      romPath: string;
      core: SystemCore;
      role: "host" | "guest";
      biosPath?: string;
    }
  | {
      step: "watching";
      romPath: string;
      core: SystemCore;
      role: "spectator";
      biosPath?: string;
    }
  | {
      step: "solo-playing";
      romPath: string;
      core: SystemCore;
      biosPath?: string;
    }
  | SessionSummaryState;

type NetplayLobbyStoreState = {
  mode: LobbyMode;
  state: LobbyState;
  joinCode: string;
  status: string;
  error: string;
  dcState: string;
  gameStarted: boolean;
  opponentProfile: OpponentProfile | null;
  searchQuery: string;
  roomVisibility: RoomVisibility;
  recentGames: RecentGame[];
  recentOpponents: RecentOpponent[];
  favoriteGames: string[];
  menuPublicRooms: PublicRoomInfo[];
  chatMessages: NetplayChatMessage[];
  chatOpen: boolean;
  chatDraft: string;
  unreadChatCount: number;
  isPeerTyping: boolean;
  chatChannelState: string;
  syncDisplay: string;
  networkStats: NetplayNetworkStats | null;
};

type NetplayLobbyStoreActions = {
  setMode: (mode: LobbyMode) => void;
  setLobbyState: (next: LobbyState | ((previous: LobbyState) => LobbyState)) => void;
  setJoinCode: (joinCode: string) => void;
  setStatus: (status: string) => void;
  setError: (error: string) => void;
  setDcState: (dcState: string) => void;
  setGameStarted: (gameStarted: boolean) => void;
  setOpponentProfile: (opponentProfile: OpponentProfile | null) => void;
  setSearchQuery: (searchQuery: string) => void;
  setRoomVisibility: (roomVisibility: RoomVisibility) => void;
  setRecentGames: (recentGames: RecentGame[]) => void;
  setRecentOpponents: (recentOpponents: RecentOpponent[]) => void;
  setFavoriteGames: (favoriteGames: string[]) => void;
  setMenuPublicRooms: (menuPublicRooms: PublicRoomInfo[]) => void;
  appendChatMessage: (message: NetplayChatMessage) => void;
  setChatOpen: (chatOpen: boolean) => void;
  setChatDraft: (chatDraft: string) => void;
  setUnreadChatCount: (unreadChatCount: number) => void;
  incrementUnreadChatCount: () => void;
  setIsPeerTyping: (isPeerTyping: boolean) => void;
  setChatChannelState: (chatChannelState: string) => void;
  setSyncDisplay: (syncDisplay: string) => void;
  setNetworkStats: (networkStats: NetplayNetworkStats | null) => void;
  resetChatState: () => void;
  resetLobby: () => void;
  resetSessionUiState: () => void;
};

export type NetplayLobbyStore = NetplayLobbyStoreState & NetplayLobbyStoreActions;

function getInitialRecentGames() {
  if (typeof window === "undefined") return [];
  return getRecentGames();
}

function getInitialRecentOpponents() {
  if (typeof window === "undefined") return [];
  return getRecentOpponents();
}

function getInitialFavoriteGames() {
  if (typeof window === "undefined") return [];
  return getFavoriteGames();
}

function getDefaultChatState() {
  return {
    chatMessages: [] as NetplayChatMessage[],
    chatOpen: false,
    chatDraft: "",
    unreadChatCount: 0,
    isPeerTyping: false,
    chatChannelState: "",
  };
}

function getDefaultSessionUiState() {
  return {
    joinCode: "",
    status: "",
    error: "",
    dcState: "",
    gameStarted: false,
    opponentProfile: null,
    syncDisplay: "",
    networkStats: null,
  };
}

function createInitialStoreState(): NetplayLobbyStoreState {
  return {
    mode: "netplay",
    state: { step: "menu" },
    searchQuery: "",
    roomVisibility: "private",
    recentGames: getInitialRecentGames(),
    recentOpponents: getInitialRecentOpponents(),
    favoriteGames: getInitialFavoriteGames(),
    menuPublicRooms: [],
    ...getDefaultSessionUiState(),
    ...getDefaultChatState(),
  };
}

export const useNetplayLobbyStore = create<NetplayLobbyStore>((set) => ({
  ...createInitialStoreState(),
  setMode: (mode) => set({ mode }),
  setLobbyState: (next) =>
    set((store) => ({
      state: typeof next === "function" ? next(store.state) : next,
    })),
  setJoinCode: (joinCode) => set({ joinCode }),
  setStatus: (status) => set({ status }),
  setError: (error) => set({ error }),
  setDcState: (dcState) => set({ dcState }),
  setGameStarted: (gameStarted) => set({ gameStarted }),
  setOpponentProfile: (opponentProfile) => set({ opponentProfile }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  setRoomVisibility: (roomVisibility) => set({ roomVisibility }),
  setRecentGames: (recentGames) => set({ recentGames }),
  setRecentOpponents: (recentOpponents) => set({ recentOpponents }),
  setFavoriteGames: (favoriteGames) => set({ favoriteGames }),
  setMenuPublicRooms: (menuPublicRooms) => set({ menuPublicRooms }),
  appendChatMessage: (message) =>
    set((store) => ({
      chatMessages: [...store.chatMessages, message].slice(-CHAT_MAX_MESSAGES),
    })),
  setChatOpen: (chatOpen) => set({ chatOpen }),
  setChatDraft: (chatDraft) => set({ chatDraft }),
  setUnreadChatCount: (unreadChatCount) => set({ unreadChatCount }),
  incrementUnreadChatCount: () =>
    set((store) => ({
      unreadChatCount: store.unreadChatCount + 1,
    })),
  setIsPeerTyping: (isPeerTyping) => set({ isPeerTyping }),
  setChatChannelState: (chatChannelState) => set({ chatChannelState }),
  setSyncDisplay: (syncDisplay) => set({ syncDisplay }),
  setNetworkStats: (networkStats) => set({ networkStats }),
  resetChatState: () => set(getDefaultChatState()),
  resetLobby: () => set(createInitialStoreState()),
  resetSessionUiState: () => set(getDefaultSessionUiState()),
}));
