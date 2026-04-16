import { useCallback, useEffect, useRef } from "react";

import {
  sendRemoteInput,
  type SystemCore,
} from "@/components/EmulatorPlayer";
import type { NetplayChatMessage } from "@/components/NetplayChatPanel";
import type { SessionEndReason } from "@/components/NetplaySessionSummary";
import { appEnvironment } from "@/config/environment";
import { parseRomName } from "@/lib/game-names";
import {
  getUserProfile,
  type RecentGame,
  type RecentOpponent,
  upsertRecentGame,
  upsertRecentOpponent,
} from "@/lib/user-profile";
import {
  NetplayPeer,
  type InputMessage,
} from "@/netplay/peer";
import { useNetplayChatControls } from "@/netplay/useNetplayChatControls";
import { useNetplaySyncRuntime } from "@/netplay/useNetplaySyncRuntime";
import {
  type ActiveSession,
  type HostRoomConfig,
  type LobbyState,
  type OpponentProfile,
  type RoomVisibility,
  type SessionSummaryState,
  type RomInfo,
} from "@/stores/useNetplayLobbyStore";
import { toast } from "sonner";

const SERVER_URL = appEnvironment.wsUrl;

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

function getRomFilename(romPath: string) {
  return romPath.split("/").pop() ?? romPath;
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
  const lastInputTimeRef = useRef(0);
  const opponentProfileRef = useRef<{ nickname: string; avatar: string } | null>(null);
  const activeSessionRef = useRef<ActiveSession | null>(null);
  const sessionStartedAtRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      peerRef.current?.close();
    };
  }, []);

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

  const recordRecentGame = useCallback(
    (session: ActiveSession) => {
      const nextRecentGames = upsertRecentGame({
        romPath: session.romPath,
        core: session.core,
        displayName: parseRomName(getRomFilename(session.romPath), session.core),
        playedAt: Date.now(),
      });
      setRecentGames(nextRecentGames);
    },
    [setRecentGames],
  );

  const recordRecentOpponent = useCallback(
    (session: ActiveSession, profile: OpponentProfile | null, endReason: SessionEndReason) => {
      if (!profile || sessionStartedAtRef.current === null) return;

      const nextRecentOpponents = upsertRecentOpponent({
        nickname: profile.nickname,
        avatar: profile.avatar,
        romPath: session.romPath,
        core: session.core,
        biosPath: session.biosPath,
        gameName: parseRomName(getRomFilename(session.romPath), session.core),
        playedAt: Date.now(),
        playCount: 1,
        lastEndReason: endReason,
      });
      setRecentOpponents(nextRecentOpponents);
    },
    [setRecentOpponents],
  );

  const markSessionStarted = useCallback(() => {
    if (sessionStartedAtRef.current !== null) return;
    sessionStartedAtRef.current = Date.now();
    if (activeSessionRef.current) {
      recordRecentGame(activeSessionRef.current);
    }
  }, [recordRecentGame]);

  const {
    handleEmulatorReady,
    handlePeerReady,
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
    setGameStarted,
    updateSync,
    markSessionStarted,
  });

  const resetChatState = useCallback(() => {
    opponentProfileRef.current = null;
    resetChatControls();
  }, [resetChatControls]);

  const resetSessionRuntime = useCallback(() => {
    peerRef.current?.close();
    peerRef.current = null;
    roleRef.current = null;
    activeSessionRef.current = null;
    sessionStartedAtRef.current = null;
    resetSyncRuntime();
    resetSessionUiState();
    resetChatState();
  }, [resetChatState, resetSessionUiState, resetSyncRuntime]);

  const resetToMenu = useCallback(() => {
    resetSessionRuntime();
    setState({ step: "menu" });
  }, [resetSessionRuntime, setState]);

  const buildSessionSummary = useCallback(
    (endReason: SessionEndReason): SessionSummaryState | null => {
      const activeSession = activeSessionRef.current;
      if (!activeSession) return null;

      const endedAt = Date.now();
      const startedAt = sessionStartedAtRef.current;

      return {
        step: "session-summary",
        ...activeSession,
        gameName: parseRomName(getRomFilename(activeSession.romPath), activeSession.core),
        startedAt,
        endedAt,
        durationMs: startedAt ? Math.max(0, endedAt - startedAt) : 0,
        endReason,
        opponentProfile: opponentProfileRef.current,
      };
    },
    [],
  );

  const completeSession = useCallback(
    (endReason: SessionEndReason) => {
      const summary = buildSessionSummary(endReason);
      if (activeSessionRef.current) {
        recordRecentOpponent(activeSessionRef.current, opponentProfileRef.current, endReason);
      }
      resetSessionRuntime();

      if (summary) {
        setState(summary);
        return;
      }

      setState({ step: "menu" });
    },
    [buildSessionSummary, recordRecentOpponent, resetSessionRuntime, setState],
  );

  const createPeer = useCallback((): NetplayPeer => {
    const peer = new NetplayPeer({
      onConnected: () => setStatus("P2P 연결됨!"),
      onDisconnected: () => {
        if (activeSessionRef.current) {
          completeSession("peer-left");
          return;
        }

        toast.error("상대방이 나갔습니다.");
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
        setStatus("상대방 접속! 게임 로딩 중...");
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
        setStatus("방 참가 완료! 연결 중...");
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
    completeSession,
    handleRemoteInput,
    handleIncomingChatMessage,
    handleIncomingTypingState,
    handlePeerReady,
    handlePeerResyncFailed,
    handlePeerResyncState,
    handlePeerSaveState,
    handlePeerStartSignal,
    handlePeerStateLoaded,
    resetToMenu,
    setChatChannelState,
    setDcState,
    setError,
    setOpponentProfile,
    setState,
    setStatus,
  ]);

  const startHostingRoom = useCallback(
    async ({ romFilename, romPath, core, biosPath, isPublic = false }: HostRoomConfig) => {
      resetSessionRuntime();
      setError("");
      setStatus("방 생성 중...");
      const peer = createPeer();
      try {
        await peer.connect(SERVER_URL);
      } catch {
        const message = "시그널링 서버 연결 실패";
        setError(message);
        toast.error(message);
        return;
      }

      const originalHandler = peer["handler"];
      const originalOnRoomCreated = originalHandler.onRoomCreated;
      originalHandler.onRoomCreated = (code: string) => {
        originalOnRoomCreated?.(code);
        setState({
          step: "waiting",
          code,
          romFilename,
          romPath,
          core,
          biosPath,
          isPublic,
        });
        setStatus("대기 중... 상대방에게 코드를 알려주세요.");
      };

      peer.createRoom(
        romPath,
        core,
        biosPath,
        getUserProfile()?.nickname,
        getUserProfile()?.avatar,
        isPublic,
      );
    },
    [createPeer, resetSessionRuntime, setError, setState, setStatus],
  );

  const handleCreateRoom = useCallback(
    async (rom: RomInfo) => {
      await startHostingRoom({
        romFilename: rom.filename,
        romPath: rom.path,
        core: rom.core as SystemCore,
        biosPath: rom.bios,
        isPublic: roomVisibility === "public",
      });
    },
    [roomVisibility, startHostingRoom],
  );

  const joinRoomWithCode = useCallback(
    async (roomCode: string) => {
      if (roomCode.length !== 6) {
        setError("6자리 코드를 입력하세요.");
        return;
      }

      resetSessionRuntime();
      setError("");
      setStatus("방 참가 중...");
      const peer = createPeer();
      try {
        await peer.connect(SERVER_URL);
      } catch {
        const message = "시그널링 서버 연결 실패";
        setError(message);
        toast.error(message);
        return;
      }
      peer.joinRoom(roomCode, getUserProfile()?.nickname, getUserProfile()?.avatar);
    },
    [createPeer, resetSessionRuntime, setError, setStatus],
  );

  const handleJoinRoom = useCallback(async () => {
    if (joinCode.length !== 6) {
      setError("6자리 코드를 입력하세요.");
      return;
    }

    await joinRoomWithCode(joinCode);
  }, [joinCode, joinRoomWithCode, setError]);

  const handleJoinPublicRoom = useCallback(
    async (roomCode: string) => {
      await joinRoomWithCode(roomCode);
    },
    [joinRoomWithCode],
  );

  const handleReplayRecentOpponent = useCallback(
    async (opponent: RecentOpponent, isPublic: boolean) => {
      setReplayOpponentTarget(null);
      await startHostingRoom({
        romFilename: getRomFilename(opponent.romPath),
        romPath: opponent.romPath,
        core: opponent.core as SystemCore,
        biosPath: opponent.biosPath,
        isPublic,
      });
    },
    [setReplayOpponentTarget, startHostingRoom],
  );

  const handleSummaryRematch = useCallback(() => {
    if (state.step !== "session-summary") return;

    void startHostingRoom({
      romFilename: getRomFilename(state.romPath),
      romPath: state.romPath,
      core: state.core,
      biosPath: state.biosPath,
      isPublic: state.isPublic,
    });
  }, [startHostingRoom, state]);

  const handleSummaryChooseAnotherGame = useCallback(() => {
    resetSessionRuntime();
    void fetchRoms();
  }, [fetchRoms, resetSessionRuntime]);

  const handleBack = useCallback(() => {
    if (state.step === "playing") {
      completeSession("self-left");
      return;
    }

    resetToMenu();
  }, [completeSession, resetToMenu, state.step]);

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
