import { useCallback, type MutableRefObject } from "react";

import type { SystemCore } from "@/components/EmulatorPlayer";
import type { SessionEndReason } from "@/components/NetplaySessionSummary";
import {
  NetplayPeer,
  type ChatMessage as PeerChatMessage,
  type InputMessage,
  type ResyncStatePayload,
} from "@/netplay/peer";
import { NETPLAY_COPY } from "@/netplay/netplayCopy";
import {
  type ActiveSession,
  type LobbyState,
  type OpponentProfile,
} from "@/stores/useNetplayLobbyStore";
import { toast } from "sonner";
import type { NetplaySessionRole } from "../../shared/emulator-protocol";
import { MAX_SPECTATORS_PER_ROOM } from "../../shared/emulator-protocol";

type SetLobbyState = (next: LobbyState | ((previous: LobbyState) => LobbyState)) => void;

type StartedNetplaySession = ActiveSession & {
  mode: "netplay";
  role: NetplaySessionRole;
};

interface UseNetplayPeerFactoryOptions {
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

export function useNetplayPeerFactory({
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
}: UseNetplayPeerFactoryOptions) {
  const createPeer = useCallback((rtcConfiguration?: RTCConfiguration): NetplayPeer => {
    const peer = new NetplayPeer({
      onConnected: () => setStatus(NETPLAY_COPY.peerConnected),
      onDisconnected: () => {
        console.warn("[LOBBY] peer disconnected callback", {
          activeRole: activeSessionRef.current?.role ?? null,
          lobbyRole: roleRef.current,
        });

        if (activeSessionRef.current?.role === "spectator") {
          toast.error(NETPLAY_COPY.peerLeft);
          resetToMenu();
          return;
        }

        if (activeSessionRef.current) {
          completeSession("peer-left");
          return;
        }

        toast.error(NETPLAY_COPY.peerLeft);
        resetToMenu();
      },
      onInput: handleRemoteInput,
      onRemoteHeldMask: handleRemoteHeldMask,
      onError: (msg) => setError(msg),
      onDataChannelState: (nextState) => setDcState(nextState),
      onChatChannelState: (nextState) => setChatChannelState(nextState),
      onChatMessage: handleIncomingChatMessage,
      onChatTyping: handleIncomingTypingState,
      onPeerReady: handlePeerReady,
      onSaveState: handlePeerSaveState,
      onStateLoaded: handlePeerStateLoaded,
      onStartSignal: handlePeerStartSignal,
      onResyncLoaded: handlePeerResyncLoaded,
      onResyncState: handlePeerResyncState,
      onResyncFailed: handlePeerResyncFailed,
      onInputSeqGap: (expected: number, got: number) => {
        console.warn(`[LOBBY] Input seq gap: expected ${expected}, got ${got}`);
      },
      onVideoStream: (stream) => handleVideoStream?.(stream),
      onHeartbeat: (ts) => handleHeartbeat?.(ts),
      onRoomKicked: (message) => {
        toast.error(message || NETPLAY_COPY.roomKicked);
        resetToMenu();
      },
      onRoomCreated: () => {
        roleRef.current = "host";
        setState((previous) => {
          if (previous.step === "browse" || previous.step === "menu") {
            return previous;
          }
          return previous;
        });
      },
      onGuestJoined: (info) => {
        if (info.guestNickname) {
          setOpponentProfile({ nickname: info.guestNickname, avatar: info.guestAvatar || "🎮" });
        }
        setStatus(NETPLAY_COPY.peerJoined);
      },
      onRoomJoined: (info) => {
        if (info.hostNickname) {
          setOpponentProfile({ nickname: info.hostNickname, avatar: info.hostAvatar || "🎮" });
        }
        roleRef.current = info.role;
        setGameStarted(false);
        activeSessionRef.current = null;
        sessionStartedAtRef.current = null;
        setState({
          step: "waiting",
          code: info.code,
          participantId: info.participantId,
          role: info.role,
          romFilename: info.romFilename,
          romPath: info.romPath,
          core: info.core as SystemCore,
          biosPath: info.bios,
          participants: [],
          canStart: false,
          isReady: false,
          spectatorSlotsRemaining: MAX_SPECTATORS_PER_ROOM,
        });
        setStatus(
          info.role === "spectator" ? NETPLAY_COPY.spectatorLobbyJoined : NETPLAY_COPY.roomLobbyJoined,
        );
      },
      onRoomLobbyUpdated: (info) => {
        let roomGameChanged = false;

        setState((previous) => {
          if (previous.step !== "waiting" || previous.code !== info.code) {
            return previous;
          }

          roomGameChanged =
            previous.romPath !== info.romPath ||
            previous.core !== info.core ||
            previous.biosPath !== info.bios;

          const selfParticipant = info.participants.find(
            (participant) => participant.id === previous.participantId,
          );

          return {
            ...previous,
            romFilename: info.romFilename,
            romPath: info.romPath,
            core: info.core as SystemCore,
            biosPath: info.bios,
            isPublic: info.isPublic,
            participants: info.participants,
            canStart: info.canStart,
            isReady: previous.role === "host" ? true : (selfParticipant?.ready ?? previous.isReady),
            spectatorSlotsRemaining: info.spectatorSlotsRemaining,
          };
        });

        if (roomGameChanged) {
          setStatus(
            roleRef.current === "host"
              ? NETPLAY_COPY.roomGameUpdated
              : NETPLAY_COPY.roomGameChangedByHost,
          );
          return;
        }

        if (roleRef.current === "host") {
          setStatus(info.canStart ? NETPLAY_COPY.roomReadyToStart : NETPLAY_COPY.waitingForRoomReady);
        }
      },
      onSessionStarted: (info) => {
        if (info.hostNickname && info.role !== "host") {
          setOpponentProfile({ nickname: info.hostNickname, avatar: info.hostAvatar || "🎮" });
        }

        setStatus(NETPLAY_COPY.roomStartRequested);

        const nextSessionBox: { current: StartedNetplaySession | null } = { current: null };

        setState((previous) => {
          if (previous.step !== "waiting" || previous.code !== info.code) {
            return previous;
          }

          nextSessionBox.current = {
            mode: "netplay",
            romPath: info.romPath,
            core: info.core as SystemCore,
            role: info.role,
            biosPath: info.bios,
            isPublic: previous.isPublic,
          };

          if (info.role === "spectator") {
            return {
              step: "watching",
              romPath: info.romPath,
              core: info.core as SystemCore,
              role: "spectator",
              biosPath: info.bios,
            };
          }

          return {
            step: "playing",
            romPath: info.romPath,
            core: info.core as SystemCore,
            role: info.role === "host" ? "host" : "guest",
            biosPath: info.bios,
          };
        });

        const nextSession = nextSessionBox.current;

        if (!nextSession) {
          return;
        }

        roleRef.current = nextSession.role;
        sessionStartedAtRef.current = null;

        if (nextSession.role === "spectator") {
          setGameStarted(true);
          activeSessionRef.current = nextSession;
          return;
        }

        setGameStarted(false);
        activeSessionRef.current = nextSession;
      },
    }, rtcConfiguration);
    peerRef.current = peer;
    return peer;
  }, [
    activeSessionRef,
    completeSession,
    handleIncomingChatMessage,
    handleIncomingTypingState,
    handlePeerReady,
    handlePeerResyncFailed,
    handlePeerResyncState,
    handlePeerSaveState,
    handlePeerStartSignal,
    handlePeerResyncLoaded,
    handlePeerStateLoaded,
    handleRemoteHeldMask,
    handleRemoteInput,
    handleVideoStream,
    handleHeartbeat,
    peerRef,
    resetToMenu,
    roleRef,
    sessionStartedAtRef,
    setChatChannelState,
    setDcState,
    setError,
    setGameStarted,
    setOpponentProfile,
    setState,
    setStatus,
  ]);

  return {
    createPeer,
  };
}
