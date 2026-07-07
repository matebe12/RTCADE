import { useCallback, type MutableRefObject } from "react";

import type { SystemCore } from "@/components/EmulatorPlayer";
import type { SessionEndReason } from "@/components/NetplaySessionSummary";
import { trackEvent } from "@/lib/analytics";
import { parseRomName } from "@/lib/game-names";
import {
  NetplayPeer,
  type ChatMessage as PeerChatMessage,
  type InputMessage,
  type NetplayNetworkStats,
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

/** {@link useNetplayPeerFactory} hook 옵션 인터페이스. */
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
  handlePeerStartSignal: () => void;
  handleVideoStream?: (stream: MediaStream) => void;
  handleNetworkStats?: (stats: NetplayNetworkStats) => void;
  handleHeartbeat?: (ts: number) => void;
  onRoomFull?: () => void;
}

const ROOM_FULL_ERROR = "방이 이미 가득 찼습니다.";

/**
 * `NetplayPeer` 인스턴스를 생성하고 모든 이벤트 핸들러를 연결하는 hook.
 * `createPeer()` 함수를 반환하며, 호출할 때마다 새 Peer를 생성한다.
 */
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
  handlePeerStartSignal,
  handleVideoStream,
  handleNetworkStats,
  handleHeartbeat,
  onRoomFull,
}: UseNetplayPeerFactoryOptions) {
  const createPeer = useCallback(
    (rtcConfiguration?: RTCConfiguration): NetplayPeer => {
      const peer = new NetplayPeer(
        {
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
          onError: (msg) => {
            if (msg === ROOM_FULL_ERROR && onRoomFull) {
              onRoomFull();
            } else {
              setError(msg);
              toast.error(msg);
            }
          },
          onDataChannelState: (nextState) => setDcState(nextState),
          onChatChannelState: (nextState) => setChatChannelState(nextState),
          onChatMessage: handleIncomingChatMessage,
          onChatTyping: handleIncomingTypingState,
          onPeerReady: handlePeerReady,
          onStartSignal: handlePeerStartSignal,
          onInputSeqGap: (expected: number, got: number) => {
            console.warn(`[LOBBY] Input seq gap: expected ${expected}, got ${got}`);
          },
          onVideoStream: (stream) => handleVideoStream?.(stream),
          onNetworkStats: (stats) => handleNetworkStats?.(stats),
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
              setOpponentProfile({
                nickname: info.guestNickname,
                avatar: info.guestAvatar || "🎮",
              });
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

            if (info.role === "guest") {
              trackEvent("netplay_room_joined", {
                core: info.core,
                game_name: parseRomName(info.romFilename ?? "", info.core),
              });
            } else if (info.role === "spectator") {
              trackEvent("spectate_started");
            }

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
              info.role === "spectator"
                ? NETPLAY_COPY.spectatorLobbyJoined
                : NETPLAY_COPY.roomLobbyJoined,
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
                isReady:
                  previous.role === "host" ? true : (selfParticipant?.ready ?? previous.isReady),
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
              setStatus(
                info.canStart ? NETPLAY_COPY.roomReadyToStart : NETPLAY_COPY.waitingForRoomReady,
              );
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
        },
        rtcConfiguration,
      );
      peerRef.current = peer;
      return peer;
    },
    [
      activeSessionRef,
      completeSession,
      handleIncomingChatMessage,
      handleIncomingTypingState,
      handlePeerReady,
      handlePeerStartSignal,
      handleRemoteHeldMask,
      handleRemoteInput,
      handleNetworkStats,
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
    ],
  );

  return {
    createPeer,
  };
}
