import { useCallback } from "react";

import NetplaySessionSummary from "./NetplaySessionSummary";
import NetplayBrowseRomsScreen from "@/components/netplay/NetplayBrowseRomsScreen";
import NetplayJoinRoomScreen from "@/components/netplay/NetplayJoinRoomScreen";
import NetplayMenuScreen from "@/components/netplay/NetplayMenuScreen";
import NetplayPlayingScreen from "@/components/netplay/NetplayPlayingScreen";
import NetplayPublicRoomsScreen from "@/components/netplay/NetplayPublicRoomsScreen";
import NetplayWaitingScreen from "@/components/netplay/NetplayWaitingScreen";
import { getUserProfile, toggleFavoriteGame } from "@/lib/user-profile";
import { useNetplayDiscovery } from "@/netplay/useNetplayDiscovery";
import { useNetplaySession } from "@/netplay/useNetplaySession";
import { useNetplayLobbyStore } from "@/stores/useNetplayLobbyStore";

export default function NetplayLobby() {
  const {
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
    replayOpponentTarget,
    setReplayOpponentTarget,
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

  const { fetchPublicRooms, fetchRoms } = useNetplayDiscovery({
    currentStep: state.step,
    setLobbyState: setState,
    setError,
    setMenuPublicRooms,
  });

  const {
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
    setReplayOpponentTarget,
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

  const handleToggleFavoriteGame = useCallback(
    (romPath: string) => {
      const nextFavorites = toggleFavoriteGame(romPath);
      setFavoriteGames(nextFavorites);
    },
    [setFavoriteGames],
  );

  const myProfile = getUserProfile();

  if (state.step === "menu") {
    return (
      <NetplayMenuScreen
        quickJoinRooms={menuPublicRooms.slice(0, 2)}
        recentOpponentPreview={recentOpponents.slice(0, 3)}
        error={error}
        replayOpponentTarget={replayOpponentTarget}
        onOpenBrowse={fetchRoms}
        onOpenPublicRooms={() => void fetchPublicRooms(true)}
        onOpenJoinInput={() => setState({ step: "join-input" })}
        onJoinPublicRoom={(roomCode) => void handleJoinPublicRoom(roomCode)}
        onReplayTargetChange={setReplayOpponentTarget}
        onReplayRecentOpponent={(opponent, isPublic) =>
          void handleReplayRecentOpponent(opponent, isPublic)
        }
      />
    );
  }

  if (state.step === "public-rooms") {
    return (
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

  if (state.step === "browse") {
    return (
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

  if (state.step === "waiting") {
    return (
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
    return (
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

  if (state.step === "session-summary") {
    const localSummaryUser = myProfile ?? { nickname: "나", avatar: "🎮" };

    return (
      <NetplaySessionSummary
        gameName={state.gameName}
        localUser={localSummaryUser}
        opponentProfile={state.opponentProfile}
        durationMs={state.durationMs}
        startedAt={state.startedAt}
        endReason={state.endReason}
        onRematch={handleSummaryRematch}
        onChooseAnotherGame={handleSummaryChooseAnotherGame}
        onGoHome={resetToMenu}
      />
    );
  }

  if (state.step === "playing") {
    return (
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
      />
    );
  }

  return null;
}
