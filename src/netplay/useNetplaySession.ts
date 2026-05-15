import { useCallback, useEffect, useRef, useState } from "react";

import type { SystemCore } from "@/components/EmulatorPlayer";
import type { NetplayChatMessage } from "@/components/NetplayChatPanel";
import { createEmulatorRuntimeBridge } from "@/lib/emulator-runtime-bridge";
import { type RecentGame, type RecentOpponent } from "@/lib/user-profile";
import {
  NetplayPeer,
  type InputMessage,
  type NetplayNetworkStats,
  type ResyncStatePayload,
} from "@/netplay/peer";
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
import {
  HEARTBEAT_INTERVAL_MS,
  HEARTBEAT_WARN_TIMEOUT_MS,
  HEARTBEAT_DANGER_TIMEOUT_MS,
  HEARTBEAT_DISCONNECT_TIMEOUT_MS,
  type DisconnectSeverity,
  type NetplaySessionRole,
} from "../../shared/emulator-protocol";

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
  appendChatMessage,
  setChatOpen,
  setChatDraft,
  setUnreadChatCount,
  incrementUnreadChatCount,
  setIsPeerTyping,
  setChatChannelState,
  setSyncDisplay,
  setNetworkStats,
  resetChatState: resetStoredChatState,
  resetSessionUiState,
  fetchRoms,
}: UseNetplaySessionOptions) {
  const syncStatusRef = useRef("");
  const peerRef = useRef<NetplayPeer | null>(null);
  const emulatorRef = useRef<HTMLDivElement>(null);
  const roleRef = useRef<NetplaySessionRole | null>(null);
  const sessionCoreRef = useRef<SystemCore | null>(null);
  const lastInputTimeRef = useRef(0);
  const remoteHeldMaskRef = useRef(0);
  const queuedRemoteHeldMaskRef = useRef<number | null>(null);
  const guestResyncPendingRef = useRef(false);
  const opponentProfileRef = useRef<OpponentProfile | null>(null);
  const activeSessionRef = useRef<ActiveSession | null>(null);
  const recordedSessionIdRef = useRef<string | null>(null);
  const sessionStartedAtRef = useRef<number | null>(null);
  const videoStreamRef = useRef<MediaStream | null>(null);
  const setVideoStreamCallbackRef = useRef<((stream: MediaStream | null) => void) | null>(null);
  const heartbeatTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastHeartbeatRef = useRef(0);
  const disconnectTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const emulatorRuntimeRef = useRef<ReturnType<typeof createEmulatorRuntimeBridge> | null>(null);

  const getEmulatorRuntime = useCallback(() => {
    if (emulatorRuntimeRef.current === null) {
      emulatorRuntimeRef.current = createEmulatorRuntimeBridge(emulatorRef);
    }

    return emulatorRuntimeRef.current;
  }, []);

  // Video streaming mode is always ON for netplay
  const videoStreamingMode = true;

  // Disconnect detection state for GUEST UI
  const [disconnectSeverity, setDisconnectSeverity] = useState<DisconnectSeverity>("connected");
  const [disconnectCountdown, setDisconnectCountdown] = useState<number | undefined>(undefined);

  useEffect(() => {
    sessionCoreRef.current =
      "core" in state ? state.core : (activeSessionRef.current?.core ?? null);
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

  const reconcileRemoteHeldMask = useCallback(
    (nextMask: number) => {
      const previousMask = remoteHeldMaskRef.current;

      if (previousMask === nextMask) return;

      for (let button = 0; button < REMOTE_INPUT_BUTTON_COUNT; button += 1) {
        const bit = 1 << button;
        const wasDown = (previousMask & bit) !== 0;
        const isDown = (nextMask & bit) !== 0;

        if (wasDown !== isDown) {
          getEmulatorRuntime().input.sendRemoteInput(button, isDown);
        }
      }

      remoteHeldMaskRef.current = nextMask;
    },
    [getEmulatorRuntime],
  );

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

  // --- Heartbeat logic (HOST sends, GUEST monitors) ---

  const clearHeartbeatTimers = useCallback(() => {
    if (heartbeatTimerRef.current) {
      clearInterval(heartbeatTimerRef.current);
      heartbeatTimerRef.current = null;
    }
    if (disconnectTimerRef.current) {
      clearInterval(disconnectTimerRef.current);
      disconnectTimerRef.current = null;
    }
  }, []);

  const startHeartbeat = useCallback(() => {
    clearHeartbeatTimers();
    lastHeartbeatRef.current = Date.now();
    setDisconnectSeverity("connected");
    setDisconnectCountdown(undefined);

    if (roleRef.current === "host") {
      // HOST sends heartbeat to GUEST
      heartbeatTimerRef.current = setInterval(() => {
        peerRef.current?.sendHeartbeat();
      }, HEARTBEAT_INTERVAL_MS);
    } else {
      // GUEST monitors heartbeat from HOST
      heartbeatTimerRef.current = setInterval(() => {
        const elapsed = Date.now() - lastHeartbeatRef.current;
        if (elapsed >= HEARTBEAT_DISCONNECT_TIMEOUT_MS) {
          setDisconnectSeverity("disconnected");
        } else if (elapsed >= HEARTBEAT_DANGER_TIMEOUT_MS) {
          setDisconnectSeverity("danger");
          const remaining = Math.ceil((HEARTBEAT_DISCONNECT_TIMEOUT_MS - elapsed) / 1000);
          setDisconnectCountdown(remaining);
        } else if (elapsed >= HEARTBEAT_WARN_TIMEOUT_MS) {
          setDisconnectSeverity("warning");
          setDisconnectCountdown(undefined);
        } else {
          setDisconnectSeverity("connected");
          setDisconnectCountdown(undefined);
        }
      }, 1000);
    }
  }, [clearHeartbeatTimers]);

  const stopHeartbeat = useCallback(() => {
    clearHeartbeatTimers();
    setDisconnectSeverity("connected");
    setDisconnectCountdown(undefined);
  }, [clearHeartbeatTimers]);

  const updateGameStarted = useCallback(
    (nextGameStarted: boolean) => {
      setGameStarted(nextGameStarted);

      if (nextGameStarted) {
        startHeartbeat();
        return;
      }

      stopHeartbeat();
    },
    [setGameStarted, startHeartbeat, stopHeartbeat],
  );

  const handleHeartbeat = useCallback((ts: number) => {
    lastHeartbeatRef.current = Date.now();
    // Reset disconnect state when heartbeat received
    setDisconnectSeverity("connected");
    setDisconnectCountdown(undefined);
    void ts; // ts is for latency measurement if needed later
  }, []);

  // Auto-disconnect when severity reaches "disconnected"
  useEffect(() => {
    if (disconnectSeverity !== "disconnected") return;
    console.warn("[LOBBY] Heartbeat timeout — auto-disconnecting");
    // Trigger session end (same as back button)
    // We'll let the lifecycle hook handle this via completeSession or similar
  }, [disconnectSeverity]);

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

  const handleRemoteInput = useCallback(
    (msg: InputMessage) => {
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
    },
    [reconcileRemoteHeldMask],
  );

  const handleRemoteHeldMask = useCallback(
    (heldMask: number) => {
      lastInputTimeRef.current = Date.now();

      if (guestResyncPendingRef.current) {
        queuedRemoteHeldMaskRef.current = heldMask;
        return;
      }

      reconcileRemoteHeldMask(heldMask);
    },
    [reconcileRemoteHeldMask],
  );

  const handleLocalInput = useCallback((button: number, down: boolean) => {
    if (roleRef.current === "spectator") {
      return;
    }

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

  const handleNetworkStats = useCallback(
    (stats: NetplayNetworkStats) => {
      setNetworkStats(stats);
    },
    [setNetworkStats],
  );

  /** HOST: video capture is now handled automatically by EmulatorPlayer via onCanvasStreamReady.
   *  This callback just logs for debugging. */
  const handleStartVideoCapture = useCallback(() => {
    if (roleRef.current !== "host") return;
    console.log(
      "[LOBBY] HOST: game started, video stream should already be flowing via captureStream()",
    );
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
      recordedSessionIdRef,
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
    setGameStarted: updateGameStarted,
    updateSync,
    markSessionStarted,
    onHostGameStarted: () => peerRef.current?.markSessionStarted(),
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
    recordedSessionIdRef,
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
    handleChangeRoomGame,
    handleJoinPublicRoom,
    handleJoinRoom,
    handleKickRoomParticipant,
    handleSetRoomReady,
    handleStartRoomSession,
    handleSpectatePublicRoom,
    handleSpectateRoom,
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
    setGameStarted: updateGameStarted,
    setChatChannelState,
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
  });

  // Start heartbeat when game starts
  useEffect(() => {
    if (gameStarted) {
      return clearHeartbeatTimers;
    }

    clearHeartbeatTimers();
    return clearHeartbeatTimers;
  }, [clearHeartbeatTimers, gameStarted]);

  return {
    chatInputRef,
    emulatorRef,
    disconnectSeverity,
    disconnectCountdown,
    handleBack,
    handleCanvasStreamReady,
    handleChatCancel,
    handleChatDraftChange,
    handleChatShortcut,
    handleChatToggle,
    handleCreateRoom,
    handleChangeRoomGame,
    handleEmulatorReady,
    handleJoinPublicRoom,
    handleJoinRoom,
    handleKickRoomParticipant,
    handleLocalInput,
    handleSetRoomReady,
    handleStartRoomSession,
    handleSpectatePublicRoom,
    handleSpectateRoom,
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
  };
}
