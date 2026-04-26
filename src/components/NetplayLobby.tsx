import { type ReactElement, useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import NetplaySessionSummary from "./NetplaySessionSummary";
import NetplayBrowseRomsScreen from "@/components/netplay/NetplayBrowseRomsScreen";
import NetplayJoinRoomScreen from "@/components/netplay/NetplayJoinRoomScreen";
import NetplayMenuScreen from "@/components/netplay/NetplayMenuScreen";
import NetplayPlayingScreen from "@/components/netplay/NetplayPlayingScreen";
import NetplayPublicRoomsScreen from "@/components/netplay/NetplayPublicRoomsScreen";
import NetplaySpectateCodeScreen from "@/components/netplay/NetplaySpectateCodeScreen";
import NetplayWaitingScreen from "@/components/netplay/NetplayWaitingScreen";
import NetplayWatchingRoomsScreen from "@/components/netplay/NetplayWatchingRoomsScreen";
import NetplayWatchingScreen from "@/components/netplay/NetplayWatchingScreen";
import SoloBrowseRomsScreen from "@/components/netplay/SoloBrowseRomsScreen";
import SoloPlayingScreen from "@/components/netplay/SoloPlayingScreen";
import { buildBackendUrl } from "@/lib/backend-url";
import { getUserProfile, toggleFavoriteGame } from "@/lib/user-profile";
import { useNetplayDiscovery } from "@/netplay/useNetplayDiscovery";
import { useNetplaySession } from "@/netplay/useNetplaySession";
import { useSoloSession } from "@/solo/useSoloSession";
import { type RomInfo, useNetplayLobbyStore } from "@/stores/useNetplayLobbyStore";
import { toast } from "sonner";

export default function NetplayLobby() {
  const location = useLocation();
  const navigate = useNavigate();
  const {
    mode,
    setMode,
    state,
    setLobbyState: setState,
    joinCode,
    setJoinCode,
    status,
    setStatus,
    error,
    setError,
    dcState,
    setDcState,
    gameStarted,
    setGameStarted,
    opponentProfile,
    setOpponentProfile,
    searchQuery,
    setSearchQuery,
    roomVisibility,
    setRoomVisibility,
    recentGames,
    setRecentGames,
    recentOpponents,
    setRecentOpponents,
    favoriteGames,
    setFavoriteGames,
    menuPublicRooms,
    setMenuPublicRooms,
    chatMessages,
    appendChatMessage: appendStoredChatMessage,
    chatOpen,
    setChatOpen,
    chatDraft,
    setChatDraft,
    unreadChatCount,
    setUnreadChatCount,
    incrementUnreadChatCount,
    isPeerTyping,
    setIsPeerTyping,
    chatChannelState,
    setChatChannelState,
    syncDisplay,
    setSyncDisplay,
    resetChatState: resetStoredChatState,
    resetSessionUiState,
  } = useNetplayLobbyStore();

  const { fetchPlayingRooms, fetchPublicRooms, fetchRoms } = useNetplayDiscovery({
    currentStep: state.step,
    setLobbyState: setState,
    setError,
    setMenuPublicRooms,
  });

  const {
    emulatorRef: soloEmulatorRef,
    handleBack: handleSoloBack,
    handleChooseAnotherGame: handleSoloChooseAnotherGame,
    startingRomPath,
    startSoloGame,
  } = useSoloSession({
    currentStep: state.step,
    setLobbyState: setState,
    setRecentGames,
    fetchSoloRoms: () => fetchRoms("solo"),
  });

  const {
    chatInputRef,
    emulatorRef,
    disconnectSeverity,
    disconnectCountdown,
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
    handleCanvasStreamReady,
    setVideoStreamCallbackRef,
    resetToMenu,
  } = useNetplaySession({
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
    appendChatMessage: appendStoredChatMessage,
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
  });

  // GUEST: video stream received from HOST via WebRTC
  const [guestVideoStream, setGuestVideoStream] = useState<MediaStream | null>(null);
  const handledEntryRequestRef = useRef<string | null>(null);
  const currentLobbyStepRef = useRef(state.step);

  useEffect(() => {
    setVideoStreamCallbackRef.current = setGuestVideoStream;
    return () => {
      setVideoStreamCallbackRef.current = null;
    };
  }, [setVideoStreamCallbackRef]);

  useEffect(() => {
    currentLobbyStepRef.current = state.step;
  }, [state.step]);

  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const entry = searchParams.get("entry");

    if (!entry) {
      handledEntryRequestRef.current = null;
      return;
    }

    const entryRequestKey = `${location.pathname}?${searchParams.toString()}`;
    if (handledEntryRequestRef.current === entryRequestKey) {
      return;
    }

    handledEntryRequestRef.current = entryRequestKey;

    const openEntryFallback = (nextEntry: "create-room" | "solo", roms?: RomInfo[]) => {
      setError("");
      setStatus("");
      setSearchQuery("");

      if (nextEntry === "solo") {
        setMode("solo");
        if (roms) {
          setState({ step: "solo-browse", roms });
          return;
        }

        void fetchRoms("solo");
        return;
      }

      setMode("netplay");
      if (roms) {
        setState({ step: "browse", roms });
        return;
      }

      void fetchRoms();
    };

    let cancelled = false;

    const runEntry = async () => {
      if (currentLobbyStepRef.current !== "menu") {
        navigate(location.pathname, { replace: true });
        return;
      }

      if (entry !== "solo" && entry !== "create-room") {
        navigate(location.pathname, { replace: true });
        return;
      }

      const romPath = searchParams.get("romPath");
      const core = searchParams.get("core");
      const requestedVisibility = searchParams.get("visibility");
      const roomVisibilityFromEntry = requestedVisibility === "public" ? "public" : "private";

      if (!romPath || !core) {
        if (entry === "create-room") {
          setRoomVisibility(roomVisibilityFromEntry);
        }
        openEntryFallback(entry);
        navigate(location.pathname, { replace: true });
        return;
      }

      try {
        const response = await fetch(buildBackendUrl("/api/roms"));
        if (!response.ok) {
          throw new Error("failed");
        }

        const roms: RomInfo[] = await response.json();
        if (cancelled) {
          return;
        }

        const matchedRom = roms.find((rom) => rom.path === romPath && rom.core === core);

        if (!matchedRom) {
          const message = "선택한 인기 게임을 찾지 못해 목록 화면으로 이동합니다.";
          setError(message);
          toast(message);
          openEntryFallback(entry, roms);
          navigate(location.pathname, { replace: true });
          return;
        }

        setError("");
        setStatus("");
        setSearchQuery("");

        if (entry === "solo") {
          setMode("solo");
          startSoloGame(matchedRom);
          navigate(location.pathname, { replace: true });
          return;
        }

        setMode("netplay");
        setRoomVisibility(roomVisibilityFromEntry);
        await handleCreateRoom(matchedRom);
        if (cancelled) {
          return;
        }

        navigate(location.pathname, { replace: true });
      } catch {
        if (cancelled) {
          return;
        }

        const message = "게임 목록을 불러오지 못해 목록 화면으로 이동합니다.";
        setError(message);
        toast.error(message);
        openEntryFallback(entry);
        navigate(location.pathname, { replace: true });
      }
    };

    void runEntry();

    return () => {
      cancelled = true;
    };
  }, [
    handleCreateRoom,
    fetchRoms,
    location.pathname,
    location.search,
    navigate,
    setError,
    setMode,
    setSearchQuery,
    setState,
    setStatus,
    startSoloGame,
  ]);

  const handleToggleFavoriteGame = useCallback(
    (romPath: string) => {
      const nextFavorites = toggleFavoriteGame(romPath);
      setFavoriteGames(nextFavorites);
    },
    [setFavoriteGames],
  );

  const canStartSoloFromLobby =
    state.step === "waiting" && state.role === "host" && state.participants.length === 1;

  const handleModeChange = useCallback(
    (nextMode: typeof mode) => {
      if (mode === nextMode) return;
      if (
        state.step === "playing" ||
        state.step === "watching" ||
        state.step === "waiting" ||
        state.step === "solo-playing"
      ) {
        return;
      }

      setMode(nextMode);
      setError("");
      setStatus("");
      setSearchQuery("");

      if (nextMode === "solo") {
        setState({ step: "solo-browse", roms: [] });
        void fetchRoms("solo");
        return;
      }

      setState({ step: "menu" });
    },
    [fetchRoms, mode, setError, setMode, setSearchQuery, setState, setStatus, state.step],
  );

  const handleWaitingRoomStart = useCallback(() => {
    if (state.step !== "waiting" || state.role !== "host") {
      return;
    }

    if (!canStartSoloFromLobby) {
      handleStartRoomSession();
      return;
    }

    const soloRom: RomInfo = {
      filename: state.romFilename,
      path: state.romPath,
      core: state.core,
      bios: state.biosPath,
    };

    resetToMenu();
    setMode("solo");
    startSoloGame(soloRom);
  }, [canStartSoloFromLobby, handleStartRoomSession, resetToMenu, setMode, startSoloGame, state]);

  const myProfile = getUserProfile();

  const handleGoHome = useCallback(() => {
    if (state.step === "session-summary" && state.mode === "solo") {
      setMode("netplay");
      setState({ step: "menu" });
      navigate("/");
      return;
    }

    resetToMenu();
    navigate("/");
  }, [navigate, resetToMenu, setMode, setState, state]);

  let content: ReactElement | null = null;

  if (state.step === "menu") {
    content = (
      <NetplayMenuScreen
        quickJoinRooms={menuPublicRooms.slice(0, 2)}
        recentOpponentPreview={recentOpponents.slice(0, 3)}
        error={error}
        onOpenBrowse={fetchRoms}
        onOpenPublicRooms={() => void fetchPublicRooms(true)}
        onOpenSpectateInput={() => setState({ step: "spectate-input" })}
        onOpenJoinInput={() => setState({ step: "join-input" })}
        onJoinPublicRoom={(roomCode) => void handleJoinPublicRoom(roomCode)}
      />
    );
  }

  if (state.step === "public-rooms") {
    content = (
      <NetplayPublicRoomsScreen
        rooms={state.rooms}
        status={status}
        error={error}
        onBack={handleBack}
        onRefresh={() => void fetchPublicRooms(false, true)}
        onJoinRoom={(roomCode) => void handleJoinPublicRoom(roomCode)}
      />
    );
  }

  if (state.step === "watch-rooms") {
    content = (
      <NetplayWatchingRoomsScreen
        rooms={state.rooms}
        status={status}
        error={error}
        onBack={handleBack}
        onRefresh={() => void fetchPlayingRooms(false, true)}
        onOpenSpectateCode={() => setState({ step: "spectate-input" })}
        onSpectateRoom={(roomCode) => void handleSpectatePublicRoom(roomCode)}
      />
    );
  }

  if (state.step === "browse") {
    content = (
      <NetplayBrowseRomsScreen
        roms={state.roms}
        searchQuery={searchQuery}
        roomVisibility={roomVisibility}
        recentGames={recentGames}
        favoriteGames={favoriteGames}
        error={error}
        onBack={handleBack}
        onSearchQueryChange={setSearchQuery}
        onRoomVisibilityChange={setRoomVisibility}
        onToggleFavoriteGame={handleToggleFavoriteGame}
        onCreateRoom={(rom) => void handleCreateRoom(rom)}
      />
    );
  }

  if (state.step === "solo-browse") {
    content = (
      <SoloBrowseRomsScreen
        roms={state.roms}
        searchQuery={searchQuery}
        recentGames={recentGames}
        favoriteGames={favoriteGames}
        error={error}
        onBack={() => handleModeChange("netplay")}
        onSearchQueryChange={setSearchQuery}
        onToggleFavoriteGame={handleToggleFavoriteGame}
        onStartSoloGame={startSoloGame}
        startingRomPath={startingRomPath}
      />
    );
  }

  if (state.step === "waiting") {
    content = (
      <NetplayWaitingScreen
        roomCode={state.code}
        role={state.role}
        romFilename={state.romFilename}
        core={state.core}
        isPublic={state.isPublic}
        participants={state.participants}
        canStart={state.canStart}
        canStartSolo={canStartSoloFromLobby}
        isReady={state.isReady}
        spectatorSlotsRemaining={state.spectatorSlotsRemaining}
        status={status}
        onBack={handleBack}
        onReadyChange={handleSetRoomReady}
        onStart={handleWaitingRoomStart}
      />
    );
  }

  if (state.step === "join-input") {
    content = (
      <NetplayJoinRoomScreen
        joinCode={joinCode}
        status={status}
        error={error}
        onBack={handleBack}
        onJoinCodeChange={setJoinCode}
        onJoinRoom={handleJoinRoom}
      />
    );
  }

  if (state.step === "spectate-input") {
    content = (
      <NetplaySpectateCodeScreen
        joinCode={joinCode}
        status={status}
        error={error}
        onBack={handleBack}
        onJoinCodeChange={setJoinCode}
        onSpectateRoom={handleSpectateRoom}
      />
    );
  }

  if (state.step === "session-summary") {
    const localSummaryUser = myProfile ?? { nickname: "나", avatar: "🎮" };

    content = (
      <NetplaySessionSummary
        gameName={state.gameName}
        localUser={localSummaryUser}
        opponentProfile={state.opponentProfile}
        durationMs={state.durationMs}
        startedAt={state.startedAt}
        endReason={state.endReason}
        mode={state.mode}
        onRematch={state.mode === "solo" ? handleSoloChooseAnotherGame : handleSummaryRematch}
        onChooseAnotherGame={
          state.mode === "solo" ? handleSoloChooseAnotherGame : handleSummaryChooseAnotherGame
        }
        onGoHome={handleGoHome}
      />
    );
  }

  if (state.step === "playing") {
    content = (
      <NetplayPlayingScreen
        session={state}
        myProfile={myProfile}
        opponentProfile={opponentProfile}
        chatOpen={chatOpen}
        unreadChatCount={unreadChatCount}
        dcState={dcState}
        gameStarted={gameStarted}
        syncDisplay={syncDisplay}
        chatMessages={chatMessages}
        chatDraft={chatDraft}
        isPeerTyping={isPeerTyping}
        chatChannelState={chatChannelState}
        inputRef={chatInputRef}
        emulatorRef={emulatorRef}
        onBack={handleBack}
        onChatToggle={handleChatToggle}
        onChatCancel={handleChatCancel}
        onChatDraftChange={handleChatDraftChange}
        onSendChat={handleSendChat}
        onLocalInput={handleLocalInput}
        onEmulatorReady={handleEmulatorReady}
        onSaveState={handleSaveState}
        onStateLoaded={handleStateLoaded}
        onSaveStateError={handleSaveStateError}
        onResyncState={handleResyncState}
        onResyncLoaded={handleResyncLoaded}
        onResyncFailed={handleResyncFailed}
        onChatShortcut={handleChatShortcut}
        onCanvasStreamReady={handleCanvasStreamReady}
        videoStream={state.step === "playing" ? guestVideoStream : null}
        disconnectSeverity={disconnectSeverity}
        disconnectCountdown={disconnectCountdown}
      />
    );
  }

  if (state.step === "watching") {
    content = (
      <NetplayWatchingScreen
        session={state}
        myProfile={myProfile}
        hostProfile={opponentProfile}
        chatOpen={chatOpen}
        unreadChatCount={unreadChatCount}
        dcState={dcState}
        chatMessages={chatMessages}
        chatDraft={chatDraft}
        isPeerTyping={isPeerTyping}
        chatChannelState={chatChannelState}
        inputRef={chatInputRef}
        emulatorRef={emulatorRef}
        onBack={handleBack}
        onChatToggle={handleChatToggle}
        onChatCancel={handleChatCancel}
        onChatDraftChange={handleChatDraftChange}
        onSendChat={handleSendChat}
        videoStream={state.step === "watching" ? guestVideoStream : null}
        disconnectSeverity={disconnectSeverity}
        disconnectCountdown={disconnectCountdown}
      />
    );
  }

  if (state.step === "solo-playing") {
    content = (
      <SoloPlayingScreen session={state} emulatorRef={soloEmulatorRef} onBack={handleSoloBack} />
    );
  }

  if (!content) {
    return null;
  }

  return (
    <div className="flex h-full flex-col gap-4">
      {content}
    </div>
  );
}
