import type { MutableRefObject } from "react";

import type { SessionEndReason } from "@/components/NetplaySessionSummary";
import {
  type ChatMessage as PeerChatMessage,
  type InputMessage,
  type NetplayPeer,
  type ResyncStatePayload,
} from "@/netplay/peer";
import { useNetplayPeerFactory } from "@/netplay/useNetplayPeerFactory";
import { useNetplayRoomEntry } from "@/netplay/useNetplayRoomEntry";
import {
  type ActiveSession,
  type LobbyState,
  type OpponentProfile,
  type RoomVisibility,
} from "@/stores/useNetplayLobbyStore";
import type { NetplaySessionRole } from "../../shared/emulator-protocol";

type SetLobbyState = (next: LobbyState | ((previous: LobbyState) => LobbyState)) => void;

interface UseNetplayPeerRoomFlowOptions {
  state: LobbyState;
  joinCode: string;
  roomVisibility: RoomVisibility;
  peerRef: MutableRefObject<NetplayPeer | null>;
  roleRef: MutableRefObject<NetplaySessionRole | null>;
  activeSessionRef: MutableRefObject<ActiveSession | null>;
  sessionStartedAtRef: MutableRefObject<number | null>;
  setLobbyState: SetLobbyState;
  setStatus: (status: string) => void;
  setError: (error: string) => void;
  setDcState: (dcState: string) => void;
  setChatChannelState: (chatChannelState: string) => void;
  setGameStarted: (gameStarted: boolean) => void;
  setOpponentProfile: (opponentProfile: OpponentProfile | null) => void;
  resetSessionRuntime: () => void;
  resetToMenu: () => void;
  completeSession: (endReason: SessionEndReason) => void;
  handleRemoteInput: (msg: InputMessage) => void;
  handleRemoteHeldMask: (heldMask: number) => void;
  handleIncomingChatMessage: (message: PeerChatMessage) => void;
  handleIncomingTypingState: (isTyping: boolean) => void;
  handlePeerReady: () => void;
  handlePeerSaveState: (stateBuffer: ArrayBuffer) => void;
  handlePeerStateLoaded: () => void;
  handlePeerStartSignal: () => void;
  handlePeerResyncLoaded: () => void;
  handlePeerResyncState: (payload: ResyncStatePayload) => void;
  handlePeerResyncFailed: () => void;
  handleVideoStream?: (stream: MediaStream) => void;
  handleHeartbeat?: (ts: number) => void;
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
  setGameStarted,
  setOpponentProfile,
  resetSessionRuntime,
  resetToMenu,
  completeSession,
  handleRemoteInput,
  handleRemoteHeldMask,
  handleIncomingChatMessage,
  handleIncomingTypingState,
  handlePeerReady,
  handlePeerSaveState,
  handlePeerStateLoaded,
  handlePeerStartSignal,
  handlePeerResyncLoaded,
  handlePeerResyncState,
  handlePeerResyncFailed,
  handleVideoStream,
  handleHeartbeat,
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
    setGameStarted,
    setOpponentProfile,
    resetToMenu,
    completeSession,
    handleRemoteInput,
    handleRemoteHeldMask,
    handleIncomingChatMessage,
    handleIncomingTypingState,
    handlePeerReady,
    handlePeerSaveState,
    handlePeerStateLoaded,
    handlePeerStartSignal,
    handlePeerResyncLoaded,
    handlePeerResyncState,
    handlePeerResyncFailed,
    handleVideoStream,
    handleHeartbeat,
  });

  const {
    handleCreateRoom,
    handleJoinPublicRoom,
    handleJoinRoom,
    handleSpectatePublicRoom,
    handleSpectateRoom,
    handleSummaryRematch,
  } = useNetplayRoomEntry({
    state,
    joinCode,
    roomVisibility,
    setLobbyState: setState,
    setStatus,
    setError,
    resetSessionRuntime,
    createPeer,
  });

  return {
    handleCreateRoom,
    handleJoinPublicRoom,
    handleJoinRoom,
    handleSpectatePublicRoom,
    handleSpectateRoom,
    handleSummaryRematch,
  };
}
