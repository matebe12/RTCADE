import { useCallback, useEffect, useRef, useState, type RefObject } from "react";

import EmulatorPlayer, { type SystemCore } from "@/components/EmulatorPlayer";
import GuestVideoDisplay from "@/components/netplay/GuestVideoDisplay";
import NetplayChatPanel, { type NetplayChatMessage } from "@/components/NetplayChatPanel";
import PlayControlsGuide from "@/components/netplay/PlayControlsGuide";
import { UserBadge } from "@/components/UserBadge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { UserProfile } from "@/lib/user-profile";
import { NETPLAY_COPY, getConnectionStatusLabel } from "@/netplay/netplayCopy";
import type { OpponentProfile } from "@/stores/useNetplayLobbyStore";
import { ArrowLeft, Loader2, Maximize2, MessageSquare, Minimize2, Wifi, WifiOff } from "lucide-react";
import type { DisconnectSeverity } from "../../../shared/emulator-protocol";

interface PlayingSession {
  core: SystemCore;
  role: "host" | "guest";
  romPath: string;
  biosPath?: string;
}

interface NetplayPlayingScreenProps {
  session: PlayingSession;
  myProfile: UserProfile | null;
  opponentProfile: OpponentProfile | null;
  chatOpen: boolean;
  unreadChatCount: number;
  dcState: string;
  gameStarted: boolean;
  syncDisplay: string;
  chatMessages: NetplayChatMessage[];
  chatDraft: string;
  isPeerTyping: boolean;
  chatChannelState: string;
  inputRef: RefObject<HTMLInputElement | null>;
  emulatorRef: RefObject<HTMLDivElement | null>;
  onBack: () => void;
  onChatToggle: () => void;
  onChatCancel: () => void;
  onChatDraftChange: (value: string) => void;
  onSendChat: () => void;
  onLocalInput: (button: number, down: boolean) => void;
  onEmulatorReady: () => void;
  onSaveState: (state: ArrayBuffer) => void;
  onStateLoaded: () => void;
  onSaveStateError: (error: string) => void;
  onResyncState: (state: ArrayBuffer) => void;
  onResyncLoaded: () => void;
  onResyncFailed: () => void;
  onChatShortcut: () => void;
  onCanvasStreamReady?: (stream: MediaStream) => void;
  videoStream: MediaStream | null;
  disconnectSeverity?: DisconnectSeverity;
  disconnectCountdown?: number;
}

export default function NetplayPlayingScreen({
  session,
  myProfile,
  opponentProfile,
  chatOpen,
  unreadChatCount,
  dcState,
  gameStarted,
  syncDisplay,
  chatMessages,
  chatDraft,
  isPeerTyping,
  chatChannelState,
  inputRef,
  emulatorRef,
  onBack,
  onChatToggle,
  onChatCancel,
  onChatDraftChange,
  onSendChat,
  onLocalInput,
  onEmulatorReady,
  onSaveState,
  onStateLoaded,
  onSaveStateError,
  onResyncState,
  onResyncLoaded,
  onResyncFailed,
  onChatShortcut,
  onCanvasStreamReady,
  videoStream,
  disconnectSeverity,
  disconnectCountdown,
}: NetplayPlayingScreenProps) {
  const localChatUser = myProfile ?? { nickname: "나", avatar: "🎮" };
  const gameAreaRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const toggleFullscreen = useCallback(() => {
    const el = gameAreaRef.current;
    if (!el) return;
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else {
      el.requestFullscreen().catch(() => {});
    }
  }, []);

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  const chatPanel = (
    <NetplayChatPanel
      open={chatOpen}
      onCancel={onChatCancel}
      messages={chatMessages}
      draft={chatDraft}
      onDraftChange={onChatDraftChange}
      onSend={onSendChat}
      unreadCount={unreadChatCount}
      isPeerTyping={isPeerTyping}
      chatChannelState={chatChannelState}
      localUser={localChatUser}
      remoteUser={opponentProfile}
      inputRef={inputRef}
    />
  );

  return (
    <div className="flex w-full flex-col gap-3">
      <div className="flex w-full flex-wrap items-center gap-3">
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="ghost" size="sm" className="text-xs">
              <ArrowLeft className="mr-1 size-3" />
              나가기
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>게임 나가기</AlertDialogTitle>
              <AlertDialogDescription>
                정말 나가시겠습니까? 현재 진행 중인 게임이 종료됩니다.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>취소</AlertDialogCancel>
              <AlertDialogAction onClick={onBack}>나가기</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
          {myProfile && (
            <UserBadge nickname={myProfile.nickname} avatar={myProfile.avatar} size="sm" />
          )}
          <span className="text-xs font-medium text-muted-foreground">VS</span>
          {opponentProfile ? (
            <UserBadge
              nickname={opponentProfile.nickname}
              avatar={opponentProfile.avatar}
              size="sm"
            />
          ) : (
            <span className="text-xs text-muted-foreground">상대방</span>
          )}
        </div>

        <Button
          type="button"
          variant={chatOpen ? "secondary" : "outline"}
          size="sm"
          className="relative text-xs"
          onClick={onChatToggle}
        >
          <MessageSquare className="size-3" />
          채팅
          {unreadChatCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -right-2 -top-2 px-1.5 py-0 text-[10px]"
            >
              {unreadChatCount}
            </Badge>
          )}
        </Button>

        <Badge variant={dcState === "open" ? "default" : "secondary"} className="gap-1 text-[10px]">
          {dcState === "open" ? <Wifi className="size-3" /> : <WifiOff className="size-3" />}
          {getConnectionStatusLabel(dcState)}
        </Badge>

        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1 text-xs"
          onClick={toggleFullscreen}
          title="전체화면"
        >
          <Maximize2 className="size-3" />
          전체화면
        </Button>
      </div>

      {!gameStarted && (
        <div className="flex w-full items-center gap-2 px-1">
          <Loader2 className="size-3 animate-spin text-muted-foreground" />
          <span className="text-xs text-muted-foreground">
            {syncDisplay || NETPLAY_COPY.defaultSyncStatus}
          </span>
        </div>
      )}

      {!isFullscreen && <PlayControlsGuide mode="netplay" />}

      {/* Game area — this div becomes fullscreen */}
      <div
        ref={gameAreaRef}
        className={cn(
          "flex w-full",
          isFullscreen
            ? "h-screen bg-black items-stretch"
            : "flex-col gap-3 xl:flex-row xl:items-start",
        )}
      >
        {/* Game wrapper */}
        <div
          className={cn(
            "relative",
            isFullscreen
              ? "flex-1 min-w-0 flex items-center justify-center"
              : "w-full xl:flex-1 xl:min-w-0",
          )}
        >
          {session.role === "guest" ? (
            <GuestVideoDisplay
              ref={emulatorRef}
              videoStream={videoStream}
              onLocalInput={onLocalInput}
              onChatShortcut={onChatShortcut}
              disconnectSeverity={disconnectSeverity}
              disconnectCountdown={disconnectCountdown}
            />
          ) : (
            <EmulatorPlayer
              ref={emulatorRef}
              romSource=""
              core={session.core}
              role={session.role}
              romPath={session.romPath}
              biosPath={session.biosPath}
              onLocalInput={onLocalInput}
              onEmulatorReady={onEmulatorReady}
              onSaveState={onSaveState}
              onStateLoaded={onStateLoaded}
              onSaveStateError={onSaveStateError}
              onResyncState={onResyncState}
              onResyncLoaded={onResyncLoaded}
              onResyncFailed={onResyncFailed}
              onChatShortcut={onChatShortcut}
              onCanvasStreamReady={onCanvasStreamReady}
            />
          )}

          {/* Fullscreen top-right controls */}
          {isFullscreen && (
            <div className="absolute right-3 top-3 z-50 flex items-center gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="relative h-8 gap-1.5 rounded-full bg-black/60 text-xs text-white backdrop-blur-sm hover:bg-black/80"
                onClick={onChatToggle}
              >
                <MessageSquare className="size-3.5" />
                채팅
                {unreadChatCount > 0 && (
                  <Badge
                    variant="destructive"
                    className="absolute -right-1.5 -top-1.5 px-1 py-0 text-[9px]"
                  >
                    {unreadChatCount}
                  </Badge>
                )}
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="h-8 w-8 rounded-full bg-black/60 p-0 text-white backdrop-blur-sm hover:bg-black/80"
                onClick={toggleFullscreen}
                title="전체화면 나가기"
              >
                <Minimize2 className="size-3.5" />
              </Button>
            </div>
          )}
        </div>

        {/* Chat panel — real flex column in fullscreen, inline otherwise */}
        {isFullscreen ? (
          chatOpen && (
            <div className="flex h-full w-[340px] shrink-0 border-l border-white/10 bg-background">
              <NetplayChatPanel
                open
                onCancel={onChatCancel}
                messages={chatMessages}
                draft={chatDraft}
                onDraftChange={onChatDraftChange}
                onSend={onSendChat}
                unreadCount={unreadChatCount}
                isPeerTyping={isPeerTyping}
                chatChannelState={chatChannelState}
                localUser={localChatUser}
                remoteUser={opponentProfile}
                inputRef={inputRef}
                className="h-full xl:h-full rounded-none border-none"
              />
            </div>
          )
        ) : (
          chatPanel
        )}
      </div>
    </div>
  );
}
