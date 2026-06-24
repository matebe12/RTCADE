import type { MutableRefObject } from "react";
import { useCallback, useRef } from "react";

import type { SessionEndReason } from "@/components/NetplaySessionSummary";
import { NETPLAY_COPY } from "@/netplay/netplayCopy";
import {
  type ChatMessage as PeerChatMessage,
  type InputMessage,
  type NetplayPeer,
  type NetplayNetworkStats,
  type ResyncStatePayload,
} from "@/netplay/peer";
import { useNetplayPeerFactory } from "@/netplay/useNetplayPeerFactory";
import { useNetplayRoomEntry } from "@/netplay/useNetplayRoomEntry";
import { toast } from "sonner";
import {
  type ActiveSession,
  type LobbyState,
  type OpponentProfile,
  type RomInfo,
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
  handleNetworkStats?: (stats: NetplayNetworkStats) => void;
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
  handleNetworkStats,
  handleHeartbeat,
}: UseNetplayPeerRoomFlowOptions) {
  const pendingAutoSpectateCodeRef = useRef<string | null>(null);
  const spectatePublicRoomRef = useRef<(code: string) => Promise<void>>(async () => {});

  const handleRoomFull = useCallback(() => {
    const code = pendingAutoSpectateCodeRef.current;
    if (!code) return;
    toast.info("방이 가득 찼서 관전 모드로 입장합니다.");
    void spectatePublicRoomRef.current(code);
  }, []);

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
    handleNetworkStats,
    handleHeartbeat,
    onRoomFull: handleRoomFull,
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

  spectatePublicRoomRef.current = handleSpectatePublicRoom;

  const joinOrAutoSpectateWithCode = useCallback(
    async (code: string) => {
      pendingAutoSpectateCodeRef.current = code;
      await handleJoinPublicRoom(code);
    },
    [handleJoinPublicRoom],
  );

  return {
    handleCreateRoom,
    handleJoinPublicRoom,
    handleJoinRoom,
    handleSetRoomReady: (ready: boolean) => {
      if (state.step !== "waiting" || state.role === "host") {
        return;
      }

      setStatus(ready ? NETPLAY_COPY.roomReadyEnabled : NETPLAY_COPY.roomReadyDisabled);
      peerRef.current?.setRoomReady(ready);
    },
    handleStartRoomSession: () => {
      if (state.step !== "waiting" || state.role !== "host") {
        return;
      }

      setStatus(NETPLAY_COPY.roomStartRequested);
      peerRef.current?.markSessionStarted();
    },
    handleKickRoomParticipant: (participantId: string) => {
      if (
        state.step !== "waiting" ||
        state.role !== "host" ||
        !participantId ||
        participantId === "host"
      ) {
        return;
      }

      setStatus(NETPLAY_COPY.roomKickRequested);
      peerRef.current?.kickRoomParticipant(participantId);
    },
    handleChangeRoomGame: (rom: RomInfo) => {
      if (state.step !== "waiting" || state.role !== "host") {
        return;
      }

      setStatus(NETPLAY_COPY.roomGameChangeRequested);
      peerRef.current?.updateRoomGame(rom.path, rom.core, rom.bios);
    },
    handleSpectatePublicRoom,
    handleSpectateRoom,
    handleSummaryRematch,
    joinOrAutoSpectateWithCode,
  };
}
