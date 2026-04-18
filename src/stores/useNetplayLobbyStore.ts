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

export type LobbyMode = "netplay" | "solo";

export type RoomVisibility = "private" | "public";

export interface ActiveSession {
  mode: LobbyMode;
  romPath: string;
  core: SystemCore;
  role?: "host" | "guest";
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
  role?: "host" | "guest";
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
  | {
      step: "waiting";
      code: string;
      romFilename: string;
      romPath: string;
      core: SystemCore;
      biosPath?: string;
      isPublic?: boolean;
    }
  | { step: "join-input" }
  | {
      step: "playing";
      romPath: string;
      core: SystemCore;
      role: "host" | "guest";
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
  replayOpponentTarget: RecentOpponent | null;
  chatMessages: NetplayChatMessage[];
  chatOpen: boolean;
  chatDraft: string;
  unreadChatCount: number;
  isPeerTyping: boolean;
  chatChannelState: string;
  syncDisplay: string;
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
  setReplayOpponentTarget: (replayOpponentTarget: RecentOpponent | null) => void;
  appendChatMessage: (message: NetplayChatMessage) => void;
  setChatOpen: (chatOpen: boolean) => void;
  setChatDraft: (chatDraft: string) => void;
  setUnreadChatCount: (unreadChatCount: number) => void;
  incrementUnreadChatCount: () => void;
  setIsPeerTyping: (isPeerTyping: boolean) => void;
  setChatChannelState: (chatChannelState: string) => void;
  setSyncDisplay: (syncDisplay: string) => void;
  resetChatState: () => void;
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
    replayOpponentTarget: null,
    syncDisplay: "",
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
  setReplayOpponentTarget: (replayOpponentTarget) => set({ replayOpponentTarget }),
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
  resetChatState: () => set(getDefaultChatState()),
  resetSessionUiState: () => set(getDefaultSessionUiState()),
}));
