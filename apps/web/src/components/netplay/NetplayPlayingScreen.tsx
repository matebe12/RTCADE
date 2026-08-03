import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { toast } from "sonner";

import EmulatorPlayer, { type SystemCore } from "@/components/EmulatorPlayer";
import GuestVideoDisplay, { sendLocalGuestInput } from "@/components/netplay/GuestVideoDisplay";
import NetplayChatOverlayComposer from "@/components/netplay/NetplayChatOverlayComposer";
import type { NetplayChatMessage } from "@/components/NetplayChatPanel";
import NetplayChatOverlayPreview from "@/components/netplay/NetplayChatOverlayPreview";
import NetplayNetworkStatsBadge from "@/components/netplay/NetplayNetworkStatsBadge";
import PlayControlsGuide from "@/components/netplay/PlayControlsGuide";
import VirtualGamepad from "@/components/VirtualGamepad";
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
} from "@rtcade/ui";
import { Badge } from "@rtcade/ui";
import { Button } from "@rtcade/ui";
import { cn } from "@rtcade/ui";
import type { UserProfile } from "@/lib/user-profile";
import { NETPLAY_COPY, getConnectionStatusLabel } from "@/netplay/netplayCopy";
import type { NetplayNetworkStats } from "@/netplay/peer";
import type { OpponentProfile } from "@/stores/useNetplayLobbyStore";
import {
  ArrowLeft,
  Loader2,
  Maximize2,
  MessageSquare,
  Minimize2,
  RotateCcw,
  Wifi,
  WifiOff,
} from "lucide-react";
import type { DisconnectSeverity } from "@rtcade/shared";
import { sendLocalFBNeoInput, sendLocalMameInput } from "@rtcade/emulator";
import { useMobileDetect } from "@/hooks/useMobileDetect";

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
  onSendChat: () => boolean;
  onLocalInput: (button: number, down: boolean) => void;
  onEmulatorReady: () => void;
  onChatShortcut: () => void;
  onCanvasStreamReady?: (stream: MediaStream) => void;
  videoStream: MediaStream | null;
  disconnectSeverity?: DisconnectSeverity;
  disconnectCountdown?: number;
  networkStats: NetplayNetworkStats | null;
  onResetGame?: () => void;
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
  onChatShortcut,
  onCanvasStreamReady,
  videoStream,
  disconnectSeverity,
  disconnectCountdown,
  networkStats,
  onResetGame,
}: NetplayPlayingScreenProps) {
  const localChatUser = myProfile ?? { nickname: "나", avatar: "🎮" };
  const gameAreaRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false); // 모바일 CSS 최대화
  const isMobile = useMobileDetect();

  // Virtual gamepad → emulator/peer input routing
  const handleVirtualInput = useCallback(
    (button: number, down: boolean) => {
      if (session.role === "guest") {
        sendLocalGuestInput(button, down);
      } else if (session.core === "mame2003") {
        sendLocalMameInput(button, down);
      } else {
        sendLocalFBNeoInput(button, down);
      }
    },
    [session.role, session.core],
  );

  const handleOverlaySend = useCallback(() => {
    if (onSendChat()) {
      onChatCancel();
    }
  }, [onChatCancel, onSendChat]);

  const toggleFullscreen = useCallback(() => {
    if (isMobile) {
      // 모바일: CSS 기반 최대화 (툴바 숨기고 캔버스+패드만)
      setIsMaximized((prev) => !prev);
    } else {
      // 데스크톱: 브라우저 전체화면 API
      const el = gameAreaRef.current;
      if (!el) return;
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      } else {
        el.requestFullscreen().catch(() => {});
      }
    }
  }, [isMobile]);

  // 모바일 최대화 모드일 때도 isMaximized=true면 동일하게 처리하기 위한 통합 플래그
  const isExpanded = isMobile ? isMaximized : isFullscreen;

  // 모바일 최대화 시 AppShell 헤더/nav 숨김 + 브라우저 전체화면 + 가로모드 전환
  useEffect(() => {
    if (isMobile && isMaximized) {
      document.body.classList.add("mobile-maximized");
      // 브라우저 전체화면 먼저 요청 (orientation lock 전제조건)
      const el = gameAreaRef.current;
      if (el && !document.fullscreenElement) {
        el.requestFullscreen().then(() => {
          // 전체화면 진입 성공 후 가로모드 고정
          screen.orientation?.lock?.("landscape")?.catch(() => {});
        }).catch(() => {});
      }
    } else {
      document.body.classList.remove("mobile-maximized");
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }
      screen.orientation?.unlock?.();
    }
    return () => {
      document.body.classList.remove("mobile-maximized");
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }
      screen.orientation?.unlock?.();
    };
  }, [isMobile, isMaximized]);

  // Android 뒤로가기 두 번 터치로 종료
  const backPressTimer = useRef(0);
  useEffect(() => {
    history.pushState(null, "", location.href);
    const handler = () => {
      const now = Date.now();
      if (now - backPressTimer.current < 2000) {
        onBack();
      } else {
        backPressTimer.current = now;
        history.pushState(null, "", location.href);
        toast("뒤로가기를 한 번 더 누르면 종료됩니다");
      }
    };
    window.addEventListener("popstate", handler);
    return () => window.removeEventListener("popstate", handler);
  }, [onBack]);

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  return (
    <div className={cn("flex w-full flex-col", isExpanded ? "flex-1 min-h-0 gap-5" : "gap-3")}>
      {/* Toolbar — 모바일 최대화 시 숨김 */}
      {!isExpanded && (
      <div className="flex w-full flex-wrap items-center gap-2">
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

        <NetplayNetworkStatsBadge stats={networkStats} />

        {/* 모바일 최대화 버튼 — 툴바에서 통합 관리하여 채팅 버튼과 겹치지 않도록 */}
        {isMobile && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1 text-xs"
            onClick={() => setIsMaximized(true)}
            title="전체화면"
          >
            <Maximize2 className="size-3" />
            <span className="hidden sm:inline">전체화면</span>
          </Button>
        )}

        {session.role === "host" && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button type="button" variant="outline" size="sm" className="gap-1 text-xs">
                <RotateCcw className="size-3" />
                리셋
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>게임 리셋</AlertDialogTitle>
                <AlertDialogDescription>
                  게임을 처음부터 다시 시작합니다.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>취소</AlertDialogCancel>
                <AlertDialogAction onClick={onResetGame}>리셋</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}

      </div>
      )}

      {!gameStarted && (
        <div className="flex w-full items-center gap-2 px-1">
          <Loader2 className="size-3 animate-spin text-muted-foreground" />
          <span className="text-xs text-muted-foreground">
            {syncDisplay || NETPLAY_COPY.defaultSyncStatus}
          </span>
        </div>
      )}

      {!isMobile && !isFullscreen && <PlayControlsGuide mode="netplay" />}

      {/* Game area — desktop: fullscreen div, mobile: flex layout */}
      <div
        ref={gameAreaRef}
        className={cn(
          "flex w-full",
          isFullscreen
            ? "h-screen bg-black items-stretch"
            : isExpanded
              ? "flex-1 min-h-0 flex-col items-center gap-3"
              : isMobile
                ? "flex-col items-center gap-2"
                : "flex-col gap-3 xl:flex-row xl:items-start",
        )}
      >
        {/* Game wrapper */}
        <div
          className={cn(
            "relative",
            isFullscreen
              ? "flex-1 min-w-0 flex items-center justify-center"
              : isExpanded
                ? "w-full flex-1 min-h-0 flex items-center justify-center game-area-landscape"
                : isMobile
                  ? "w-full flex-shrink-0"
                  : "w-full xl:flex-1 xl:min-w-0",
          )}
        >
          {session.role === "guest" ? (
            <GuestVideoDisplay
              ref={emulatorRef}
              videoStream={videoStream}
              captureInput={gameStarted}
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
              onChatShortcut={onChatShortcut}
              onCanvasStreamReady={onCanvasStreamReady}
              hideFullscreen={isMobile}
            />
          )}

          {/* Expanded top-right controls (desktop fullscreen or mobile maximized) */}
          {isExpanded && (
            <div className="absolute right-3 top-3 z-50 flex items-center gap-2">
              <NetplayNetworkStatsBadge stats={networkStats} compact className="bg-black/60" />
              {session.role === "host" && (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="h-8 gap-1.5 rounded-full bg-black/60 text-xs text-white backdrop-blur-sm hover:bg-black/80"
                  onClick={onResetGame}
                  title="게임 리셋"
                >
                  <RotateCcw className="size-3.5" />
                  리셋
                </Button>
              )}
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
                title={isMobile ? "최대화 종료" : "전체화면 나가기"}
              >
                <Minimize2 className="size-3.5" />
              </Button>
            </div>
          )}

          {!isExpanded && (
            <div className="absolute left-3 top-3 z-20 xl:hidden">
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
            </div>
          )}

          <NetplayChatOverlayPreview
            visible
            messages={chatMessages}
            localUser={localChatUser}
            remoteUser={opponentProfile}
            className={chatOpen ? "bottom-20 sm:bottom-24" : undefined}
          />

          {chatOpen && (
            <div className="absolute bottom-2 left-2 z-30 flex w-[min(20rem,calc(100%-1rem))] justify-start sm:w-[20rem]">
              <NetplayChatOverlayComposer
                open={chatOpen}
                onCancel={onChatCancel}
                draft={chatDraft}
                onDraftChange={onChatDraftChange}
                onSend={handleOverlaySend}
                isPeerTyping={isPeerTyping}
                chatChannelState={chatChannelState}
                remoteUser={opponentProfile}
                inputRef={inputRef}
              />
            </div>
          )}
        </div>

        {/* Virtual gamepad — mobile only, always visible */}
        {isMobile && gameStarted && (
          <div className={cn(
            "virtual-gamepad flex-shrink-0",
            isExpanded
              ? "fixed inset-0 z-30 pointer-events-none"
              : "w-full pb-safe flex items-end pt-6 pb-4 mt-auto",
          )}>
            <VirtualGamepad
              onLocalInput={handleVirtualInput}
              active={gameStarted}
              landscape={isExpanded}
            />
          </div>
        )}
      </div>
    </div>
  );
}
