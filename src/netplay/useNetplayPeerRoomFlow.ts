import type { MutableRefObject } from "react";

import type { SessionEndReason } from "@/components/NetplaySessionSummary";
import type { RecentOpponent } from "@/lib/user-profile";
import {
  type ChatMessage as PeerChatMessage,
  type InputMessage,
  type NetplayPeer,
} from "@/netplay/peer";
import { useNetplayPeerFactory } from "@/netplay/useNetplayPeerFactory";
import { useNetplayRoomEntry } from "@/netplay/useNetplayRoomEntry";
import {
  type ActiveSession,
  type LobbyState,
  type OpponentProfile,
  type RoomVisibility,
} from "@/stores/useNetplayLobbyStore";

type SetLobbyState = (next: LobbyState | ((previous: LobbyState) => LobbyState)) => void;

interface UseNetplayPeerRoomFlowOptions {
  state: LobbyState;
  joinCode: string;
  roomVisibility: RoomVisibility;
  peerRef: MutableRefObject<NetplayPeer | null>;
  roleRef: MutableRefObject<"host" | "guest" | null>;
  activeSessionRef: MutableRefObject<ActiveSession | null>;
  sessionStartedAtRef: MutableRefObject<number | null>;
  setLobbyState: SetLobbyState;
  setStatus: (status: string) => void;
  setError: (error: string) => void;
  setDcState: (dcState: string) => void;
  setChatChannelState: (chatChannelState: string) => void;
  setOpponentProfile: (opponentProfile: OpponentProfile | null) => void;
  setReplayOpponentTarget: (replayOpponentTarget: RecentOpponent | null) => void;
  resetSessionRuntime: () => void;
  resetToMenu: () => void;
  completeSession: (endReason: SessionEndReason) => void;
  handleRemoteInput: (msg: InputMessage) => void;
  handleIncomingChatMessage: (message: PeerChatMessage) => void;
  handleIncomingTypingState: (isTyping: boolean) => void;
  handlePeerReady: () => void;
  handlePeerSaveState: (stateBuffer: ArrayBuffer) => void;
  handlePeerStateLoaded: () => void;
  handlePeerStartSignal: () => void;
  handlePeerResyncState: (stateBuffer: ArrayBuffer) => void;
  handlePeerResyncFailed: () => void;
}

export function useNetplayPeerRoomFlow({
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
  handlePeerResyncState,
  handlePeerResyncFailed,
}: UseNetplayPeerRoomFlowOptions) {
  const { createPeer } = useNetplayPeerFactory({
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
    resetToMenu,
    completeSession,
    handleRemoteInput,
    handleIncomingChatMessage,
    handleIncomingTypingState,
    handlePeerReady,
    handlePeerSaveState,
    handlePeerStateLoaded,
    handlePeerStartSignal,
    handlePeerResyncState,
    handlePeerResyncFailed,
  });

  const {
    handleCreateRoom,
    handleJoinPublicRoom,
    handleJoinRoom,
    handleReplayRecentOpponent,
    handleSummaryRematch,
  } = useNetplayRoomEntry({
    state,
    joinCode,
    roomVisibility,
    setLobbyState: setState,
    setStatus,
    setError,
    setReplayOpponentTarget,
    resetSessionRuntime,
    createPeer,
  });

  return {
    handleCreateRoom,
    handleJoinPublicRoom,
    handleJoinRoom,
    handleReplayRecentOpponent,
    handleSummaryRematch,
  };
}
