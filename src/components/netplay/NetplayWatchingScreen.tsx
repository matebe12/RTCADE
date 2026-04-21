import { useCallback, useEffect, useRef, useState, type RefObject } from "react";

import NetplayChatPanel, { type NetplayChatMessage } from "@/components/NetplayChatPanel";
import GuestVideoDisplay from "@/components/netplay/GuestVideoDisplay";
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
import { getConnectionStatusLabel } from "@/netplay/netplayCopy";
import type { OpponentProfile } from "@/stores/useNetplayLobbyStore";
import { ArrowLeft, Eye, Maximize2, MessageSquare, Minimize2, Wifi, WifiOff } from "lucide-react";
import type { DisconnectSeverity } from "../../../shared/emulator-protocol";

interface WatchingSession {
  role: "spectator";
}

interface NetplayWatchingScreenProps {
  session: WatchingSession;
  myProfile: UserProfile | null;
  hostProfile: OpponentProfile | null;
  chatOpen: boolean;
  unreadChatCount: number;
  dcState: string;
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
  videoStream: MediaStream | null;
  disconnectSeverity?: DisconnectSeverity;
  disconnectCountdown?: number;
}

export default function NetplayWatchingScreen({
  session: _session,
  myProfile,
  hostProfile,
  chatOpen,
  unreadChatCount,
  dcState,
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
  videoStream,
  disconnectSeverity,
  disconnectCountdown,
}: NetplayWatchingScreenProps) {
  const localChatUser = myProfile ?? { nickname: "나", avatar: "👀" };
  const gameAreaRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const toggleFullscreen = useCallback(() => {
    const element = gameAreaRef.current;
    if (!element) return;
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else {
      element.requestFullscreen().catch(() => {});
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
      remoteUser={hostProfile}
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
              관전 종료
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>관전 종료</AlertDialogTitle>
              <AlertDialogDescription>
                관전을 종료하시겠습니까? 현재 플레이 중인 방에는 영향이 없습니다.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>취소</AlertDialogCancel>
              <AlertDialogAction onClick={onBack}>종료</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <Badge variant="secondary" className="gap-1 text-[10px]">
          <Eye className="size-3" />
          관전 중
        </Badge>

        <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
          {myProfile && (
            <UserBadge nickname={myProfile.nickname} avatar={myProfile.avatar} size="sm" />
          )}
          <span className="text-xs font-medium text-muted-foreground">시청</span>
          {hostProfile ? (
            <UserBadge nickname={hostProfile.nickname} avatar={hostProfile.avatar} size="sm" />
          ) : (
            <span className="text-xs text-muted-foreground">호스트</span>
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
        >
          <Maximize2 className="size-3" />
          전체화면
        </Button>
      </div>

      <div
        ref={gameAreaRef}
        className={cn(
          "flex w-full",
          isFullscreen
            ? "h-screen items-stretch bg-black"
            : "flex-col gap-3 xl:flex-row xl:items-start",
        )}
      >
        <div
          className={cn(
            "relative",
            isFullscreen
              ? "flex min-w-0 flex-1 items-center justify-center"
              : "w-full xl:min-w-0 xl:flex-1",
          )}
        >
          <GuestVideoDisplay
            ref={emulatorRef}
            videoStream={videoStream}
            captureInput={false}
            disconnectSeverity={disconnectSeverity}
            disconnectCountdown={disconnectCountdown}
          />

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

        {isFullscreen
          ? chatOpen && (
              <div className="flex h-full w-85 shrink-0 border-l border-white/10 bg-background">
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
                  remoteUser={hostProfile}
                  inputRef={inputRef}
                  className="h-full rounded-none border-none xl:h-full"
                />
              </div>
            )
          : chatPanel}
      </div>
    </div>
  );
}
