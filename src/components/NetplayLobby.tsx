import { type ReactElement, useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import NetplaySessionSummary from "./NetplaySessionSummary";
import NetplayBrowseRomsScreen from "@/components/netplay/NetplayBrowseRomsScreen";
import NetplayJoinRoomScreen from "@/components/netplay/NetplayJoinRoomScreen";
import NetplayMenuScreen from "@/components/netplay/NetplayMenuScreen";
import NetplayModeTabs from "@/components/netplay/NetplayModeTabs";
import NetplayPlayingScreen from "@/components/netplay/NetplayPlayingScreen";
import NetplayPublicRoomsScreen from "@/components/netplay/NetplayPublicRoomsScreen";
import NetplaySpectateCodeScreen from "@/components/netplay/NetplaySpectateCodeScreen";
import NetplayWaitingScreen from "@/components/netplay/NetplayWaitingScreen";
import NetplayWatchingRoomsScreen from "@/components/netplay/NetplayWatchingRoomsScreen";
import NetplayWatchingScreen from "@/components/netplay/NetplayWatchingScreen";
import SoloBrowseRomsScreen from "@/components/netplay/SoloBrowseRomsScreen";
import SoloPlayingScreen from "@/components/netplay/SoloPlayingScreen";
import { getUserProfile, toggleFavoriteGame } from "@/lib/user-profile";
import { useNetplayDiscovery } from "@/netplay/useNetplayDiscovery";
import { useNetplaySession } from "@/netplay/useNetplaySession";
import { useSoloSession } from "@/solo/useSoloSession";
import { useNetplayLobbyStore } from "@/stores/useNetplayLobbyStore";

export default function NetplayLobby() {
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

  useEffect(() => {
    setVideoStreamCallbackRef.current = setGuestVideoStream;
    return () => {
      setVideoStreamCallbackRef.current = null;
    };
  }, [setVideoStreamCallbackRef]);

  const handleToggleFavoriteGame = useCallback(
    (romPath: string) => {
      const nextFavorites = toggleFavoriteGame(romPath);
      setFavoriteGames(nextFavorites);
    },
    [setFavoriteGames],
  );

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
        onOpenWatchingRooms={() => void fetchPlayingRooms(true)}
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
        romFilename={state.romFilename}
        core={state.core}
        isPublic={state.isPublic}
        status={status}
        onBack={handleBack}
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

  const disableModeSwitch =
    state.step === "playing" ||
    state.step === "watching" ||
    state.step === "waiting" ||
    state.step === "solo-playing";

  return (
    <div className="flex h-full flex-col gap-4">
      <NetplayModeTabs mode={mode} disabled={disableModeSwitch} onModeChange={handleModeChange} />
      {content}
    </div>
  );
}
