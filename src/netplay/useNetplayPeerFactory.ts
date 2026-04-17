import { useCallback, type MutableRefObject } from "react";

import type { SystemCore } from "@/components/EmulatorPlayer";
import type { SessionEndReason } from "@/components/NetplaySessionSummary";
import {
  NetplayPeer,
  type ChatMessage as PeerChatMessage,
  type InputMessage,
} from "@/netplay/peer";
import { NETPLAY_COPY } from "@/netplay/netplayCopy";
import {
  type ActiveSession,
  type LobbyState,
  type OpponentProfile,
} from "@/stores/useNetplayLobbyStore";
import { toast } from "sonner";

type SetLobbyState = (next: LobbyState | ((previous: LobbyState) => LobbyState)) => void;

interface UseNetplayPeerFactoryOptions {
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
}: UseNetplayPeerFactoryOptions) {
  const createPeer = useCallback((): NetplayPeer => {
    const peer = new NetplayPeer({
      onConnected: () => setStatus(NETPLAY_COPY.peerConnected),
      onDisconnected: () => {
        if (activeSessionRef.current) {
          completeSession("peer-left");
          return;
        }

        toast.error(NETPLAY_COPY.peerLeft);
        resetToMenu();
      },
      onInput: handleRemoteInput,
      onError: (msg) => setError(msg),
      onDataChannelState: (nextState) => setDcState(nextState),
      onChatChannelState: (nextState) => setChatChannelState(nextState),
      onChatMessage: handleIncomingChatMessage,
      onChatTyping: handleIncomingTypingState,
      onPeerReady: handlePeerReady,
      onSaveState: handlePeerSaveState,
      onStateLoaded: handlePeerStateLoaded,
      onStartSignal: handlePeerStartSignal,
      onResyncState: handlePeerResyncState,
      onResyncFailed: handlePeerResyncFailed,
      onInputSeqGap: (expected: number, got: number) => {
        console.warn(`[LOBBY] Input seq gap: expected ${expected}, got ${got}`);
      },
      onRoomCreated: () => {
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
        setState((previous) => {
          if (previous.step === "waiting") {
            roleRef.current = "host";
            activeSessionRef.current = {
              romPath: previous.romPath,
              core: previous.core,
              role: "host",
              biosPath: previous.biosPath,
              isPublic: previous.isPublic,
            };
            sessionStartedAtRef.current = null;
            return {
              step: "playing",
              romPath: previous.romPath,
              core: previous.core,
              role: "host",
              biosPath: previous.biosPath,
            };
          }
          return previous;
        });
      },
      onRoomJoined: (info) => {
        if (info.hostNickname) {
          setOpponentProfile({ nickname: info.hostNickname, avatar: info.hostAvatar || "🎮" });
        }
        setStatus(NETPLAY_COPY.roomJoined);
        roleRef.current = "guest";
        activeSessionRef.current = {
          romPath: info.romFilename,
          core: info.core as SystemCore,
          role: "guest",
          biosPath: info.bios,
        };
        sessionStartedAtRef.current = null;
        setState({
          step: "playing",
          romPath: info.romFilename,
          core: info.core as SystemCore,
          role: "guest",
          biosPath: info.bios,
        });
      },
    });
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
    handlePeerStateLoaded,
    handleRemoteInput,
    peerRef,
    resetToMenu,
    roleRef,
    sessionStartedAtRef,
    setChatChannelState,
    setDcState,
    setError,
    setOpponentProfile,
    setState,
    setStatus,
  ]);

  return {
    createPeer,
  };
}
