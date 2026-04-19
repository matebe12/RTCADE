import { useCallback, useEffect, useRef } from "react";

import type { SystemCore } from "@/components/EmulatorPlayer";
import type { NetplayChatMessage } from "@/components/NetplayChatPanel";
import { createEmulatorRuntimeBridge } from "@/lib/emulator-runtime-bridge";
import { type RecentGame, type RecentOpponent } from "@/lib/user-profile";
import { NetplayPeer, type InputMessage, type ResyncStatePayload } from "@/netplay/peer";
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

const REMOTE_INPUT_BUTTON_COUNT = 12;

function updateHeldMask(mask: number, button: number, down: boolean) {
  if (button < 0 || button >= REMOTE_INPUT_BUTTON_COUNT) return mask;
  const bit = 1 << button;
  return down ? mask | bit : mask & ~bit;
}

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
  const remoteHeldMaskRef = useRef(0);
  const queuedRemoteHeldMaskRef = useRef<number | null>(null);
  const guestResyncPendingRef = useRef(false);
  const opponentProfileRef = useRef<OpponentProfile | null>(null);
  const activeSessionRef = useRef<ActiveSession | null>(null);
  const sessionStartedAtRef = useRef<number | null>(null);
  const videoStreamRef = useRef<MediaStream | null>(null);
  const setVideoStreamCallbackRef = useRef<((stream: MediaStream | null) => void) | null>(null);
  const emulatorRuntime = createEmulatorRuntimeBridge(emulatorRef);

  // Video streaming mode is always ON for netplay
  const videoStreamingMode = true;

  useEffect(() => {
    sessionCoreRef.current = "core" in state ? state.core : activeSessionRef.current?.core ?? null;
  }, [state]);

  useEffect(() => {
    opponentProfileRef.current = opponentProfile;
  }, [opponentProfile]);

  useEffect(() => {
    if (state.step === "playing") return;
    remoteHeldMaskRef.current = 0;
    queuedRemoteHeldMaskRef.current = null;
    guestResyncPendingRef.current = false;
  }, [state.step]);

  const reconcileRemoteHeldMask = useCallback((nextMask: number) => {
    const previousMask = remoteHeldMaskRef.current;

    if (previousMask === nextMask) return;

    for (let button = 0; button < REMOTE_INPUT_BUTTON_COUNT; button += 1) {
      const bit = 1 << button;
      const wasDown = (previousMask & bit) !== 0;
      const isDown = (nextMask & bit) !== 0;

      if (wasDown !== isDown) {
        emulatorRuntime.input.sendRemoteInput(button, isDown);
      }
    }

    remoteHeldMaskRef.current = nextMask;
  }, [emulatorRuntime]);

  const handleGuestResyncState = useCallback((payload: ResyncStatePayload) => {
    if (roleRef.current !== "guest") return;

    guestResyncPendingRef.current = true;
    queuedRemoteHeldMaskRef.current = null;
    remoteHeldMaskRef.current = payload.remoteHeldMask;
  }, []);

  const handleGuestResyncLoaded = useCallback(() => {
    if (roleRef.current !== "guest") return;

    guestResyncPendingRef.current = false;

    const queuedHeldMask = queuedRemoteHeldMaskRef.current;
    queuedRemoteHeldMaskRef.current = null;

    if (queuedHeldMask !== null) {
      reconcileRemoteHeldMask(queuedHeldMask);
    }
  }, [reconcileRemoteHeldMask]);

  const handleGuestResyncFailed = useCallback(() => {
    if (roleRef.current !== "guest") return;

    guestResyncPendingRef.current = false;
    queuedRemoteHeldMaskRef.current = null;
  }, []);

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

    const nextHeldMask =
      typeof msg.heldMask === "number"
        ? msg.heldMask
        : updateHeldMask(remoteHeldMaskRef.current, msg.button, msg.down);

    if (guestResyncPendingRef.current) {
      queuedRemoteHeldMaskRef.current = nextHeldMask;
      return;
    }

    reconcileRemoteHeldMask(nextHeldMask);
  }, [reconcileRemoteHeldMask]);

  const handleRemoteHeldMask = useCallback((heldMask: number) => {
    lastInputTimeRef.current = Date.now();

    if (guestResyncPendingRef.current) {
      queuedRemoteHeldMaskRef.current = heldMask;
      return;
    }

    reconcileRemoteHeldMask(heldMask);
  }, [reconcileRemoteHeldMask]);

  const handleLocalInput = useCallback((button: number, down: boolean) => {
    lastInputTimeRef.current = Date.now();
    peerRef.current?.sendInput(button, down);
  }, []);

  // --- Video streaming handlers ---

  /** HOST: canvas stream is ready → attach to peer connection */
  const handleCanvasStreamReady = useCallback((stream: MediaStream) => {
    console.log("[LOBBY] HOST canvas stream ready, attaching to peer");
    peerRef.current?.startVideoStreaming(stream);
  }, []);

  /** GUEST: video stream received from HOST via WebRTC */
  const handleVideoStream = useCallback((stream: MediaStream) => {
    console.log("[LOBBY] GUEST received video stream from HOST");
    videoStreamRef.current = stream;
    setVideoStreamCallbackRef.current?.(stream);
  }, []);

  /** HOST: trigger video capture after game starts */
  const handleStartVideoCapture = useCallback(() => {
    if (roleRef.current !== "host") return;
    console.log("[LOBBY] HOST starting video capture");
    emulatorRuntime.sync.startVideoCapture();
  }, [emulatorRuntime]);

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
    lastInputTimeRef,
    sessionCoreRef,
    videoStreamingMode,
    onGuestResyncLoaded: handleGuestResyncLoaded,
    onGuestResyncFailed: handleGuestResyncFailed,
    onGuestResyncState: handleGuestResyncState,
    setGameStarted,
    updateSync,
    markSessionStarted,
    onStartVideoCapture: handleStartVideoCapture,
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
  });

  return {
    chatInputRef,
    emulatorRef,
    handleBack,
    handleCanvasStreamReady,
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
    handleVideoStream,
    resetToMenu,
    setVideoStreamCallbackRef,
    videoStreamRef,
  };
}
