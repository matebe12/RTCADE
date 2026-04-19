import { useCallback, useEffect, useRef } from "react";

import type { SystemCore } from "@/components/EmulatorPlayer";
import { sendRemoteInput } from "@/components/EmulatorPlayer";
import type { NetplayChatMessage } from "@/components/NetplayChatPanel";
import { type RecentGame, type RecentOpponent } from "@/lib/user-profile";
import { NetplayPeer, type InputMessage } from "@/netplay/peer";
import { useNetplayChatControls } from "@/netplay/useNetplayChatControls";
import { useNetplayPeerRoomFlow } from "@/netplay/useNetplayPeerRoomFlow";
import { useNetplaySessionHistory } from "@/netplay/useNetplaySessionHistory";
import { useNetplaySessionLifecycle } from "@/netplay/useNetplaySessionLifecycle";
import { useNetplaySyncRuntime } from "@/netplay/useNetplaySyncRuntime";
import {
  type ActiveSession,
  type LobbyState,
  type OpponentProfile,
  type RoomVisibility,
} from "@/stores/useNetplayLobbyStore";

type SetLobbyState = (next: LobbyState | ((previous: LobbyState) => LobbyState)) => void;

interface UseNetplaySessionOptions {
  state: LobbyState;
  setLobbyState: SetLobbyState;
  joinCode: string;
  roomVisibility: RoomVisibility;
  chatOpen: boolean;
  chatDraft: string;
  chatChannelState: string;
  dcState: string;
  gameStarted: boolean;
  opponentProfile: OpponentProfile | null;
  setStatus: (status: string) => void;
  setError: (error: string) => void;
  setDcState: (dcState: string) => void;
  setGameStarted: (gameStarted: boolean) => void;
  setOpponentProfile: (opponentProfile: OpponentProfile | null) => void;
  setRecentGames: (recentGames: RecentGame[]) => void;
  setRecentOpponents: (recentOpponents: RecentOpponent[]) => void;
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
  fetchRoms: () => Promise<void>;
}

export function useNetplaySession({
  state,
  setLobbyState: setState,
  joinCode,
  roomVisibility,
  chatOpen,
  chatDraft,
  chatChannelState,
  dcState,
  gameStarted,
  opponentProfile,
  setStatus,
  setError,
  setDcState,
  setGameStarted,
  setOpponentProfile,
  setRecentGames,
  setRecentOpponents,
  setReplayOpponentTarget,
  appendChatMessage,
  setChatOpen,
  setChatDraft,
  setUnreadChatCount,
  incrementUnreadChatCount,
  setIsPeerTyping,
  setChatChannelState,
  setSyncDisplay,
  resetChatState: resetStoredChatState,
  resetSessionUiState,
  fetchRoms,
}: UseNetplaySessionOptions) {
  const syncStatusRef = useRef("");
  const peerRef = useRef<NetplayPeer | null>(null);
  const emulatorRef = useRef<HTMLIFrameElement>(null);
  const roleRef = useRef<"host" | "guest" | null>(null);
  const sessionCoreRef = useRef<SystemCore | null>(null);
  const lastInputTimeRef = useRef(0);
  const opponentProfileRef = useRef<OpponentProfile | null>(null);
  const activeSessionRef = useRef<ActiveSession | null>(null);
  const sessionStartedAtRef = useRef<number | null>(null);

  useEffect(() => {
    sessionCoreRef.current = "core" in state ? state.core : activeSessionRef.current?.core ?? null;
  }, [state]);

  useEffect(() => {
    opponentProfileRef.current = opponentProfile;
  }, [opponentProfile]);

  const {
    chatInputRef,
    handleChatCancel,
    handleChatDraftChange,
    handleChatShortcut,
    handleChatToggle,
    handleIncomingChatMessage,
    handleIncomingTypingState,
    handleSendChat,
    resetChatRuntime: resetChatControls,
  } = useNetplayChatControls({
    currentStep: state.step,
    chatOpen,
    chatDraft,
    chatChannelState,
    peerRef,
    emulatorRef,
    opponentProfileRef,
    appendChatMessage,
    setChatOpen,
    setChatDraft,
    setUnreadChatCount,
    incrementUnreadChatCount,
    setIsPeerTyping,
    resetStoredChatState,
  });

  const handleRemoteInput = useCallback((msg: InputMessage) => {
    lastInputTimeRef.current = Date.now();
    sendRemoteInput(emulatorRef, msg.button, msg.down);
  }, []);

  const handleLocalInput = useCallback((button: number, down: boolean) => {
    lastInputTimeRef.current = Date.now();
    peerRef.current?.sendInput(button, down);
  }, []);

  const updateSync = useCallback(
    (msg: string) => {
      syncStatusRef.current = msg;
      setSyncDisplay(msg);
    },
    [setSyncDisplay],
  );

  const { buildSessionSummary, markSessionStarted, recordRecentOpponent } =
    useNetplaySessionHistory({
      activeSessionRef,
      opponentProfileRef,
      sessionStartedAtRef,
      setRecentGames,
      setRecentOpponents,
    });

  const {
    handleEmulatorReady,
    handlePeerReady,
    handlePeerResyncLoaded,
    handlePeerResyncFailed,
    handlePeerResyncState,
    handlePeerSaveState,
    handlePeerStartSignal,
    handlePeerStateLoaded,
    handleResyncFailed,
    handleResyncLoaded,
    handleResyncState,
    handleSaveState,
    handleSaveStateError,
    handleStateLoaded,
    resetSyncRuntime,
  } = useNetplaySyncRuntime({
    dcState,
    gameStarted,
    peerRef,
    emulatorRef,
    roleRef,
    sessionCoreRef,
    setGameStarted,
    updateSync,
    markSessionStarted,
  });

  const {
    completeSession,
    handleBack,
    handleSummaryChooseAnotherGame,
    resetSessionRuntime,
    resetToMenu,
  } = useNetplaySessionLifecycle({
    state,
    setLobbyState: setState,
    peerRef,
    roleRef,
    activeSessionRef,
    opponentProfileRef,
    sessionStartedAtRef,
    resetSyncRuntime,
    resetChatRuntime: resetChatControls,
    resetSessionUiState,
    buildSessionSummary,
    recordRecentOpponent,
    fetchRoms,
  });

  const {
    handleCreateRoom,
    handleJoinPublicRoom,
    handleJoinRoom,
    handleReplayRecentOpponent,
    handleSummaryRematch,
  } = useNetplayPeerRoomFlow({
    state,
    joinCode,
    roomVisibility,
    peerRef,
    roleRef,
    activeSessionRef,
    sessionStartedAtRef,
    setLobbyState: setState,
    setStatus,
    setError,
    setDcState,
    setChatChannelState,
    setOpponentProfile,
    setReplayOpponentTarget,
    resetSessionRuntime,
    resetToMenu,
    completeSession,
    handleRemoteInput,
    handleIncomingChatMessage,
    handleIncomingTypingState,
    handlePeerReady,
    handlePeerSaveState,
    handlePeerStateLoaded,
    handlePeerStartSignal,
    handlePeerResyncLoaded,
    handlePeerResyncState,
    handlePeerResyncFailed,
  });

  return {
    chatInputRef,
    emulatorRef,
    handleBack,
    handleChatCancel,
    handleChatDraftChange,
    handleChatShortcut,
    handleChatToggle,
    handleCreateRoom,
    handleEmulatorReady,
    handleJoinPublicRoom,
    handleJoinRoom,
    handleLocalInput,
    handleReplayRecentOpponent,
    handleResyncFailed,
    handleResyncLoaded,
    handleResyncState,
    handleSaveState,
    handleSaveStateError,
    handleSendChat,
    handleStateLoaded,
    handleSummaryChooseAnotherGame,
    handleSummaryRematch,
    resetToMenu,
  };
}
