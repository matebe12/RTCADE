import { Globe, MessageSquare } from "lucide-react";

import { UserBadge } from "@/components/UserBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { parseRomName } from "@/lib/game-names";
import { cn } from "@/lib/utils";
import type { RecentOpponent } from "@/lib/user-profile";
import type { PublicRoomInfo } from "@/stores/useNetplayLobbyStore";

interface NetplayMenuScreenProps {
  quickJoinRooms: PublicRoomInfo[];
  recentOpponentPreview: RecentOpponent[];
  error: string;
  onOpenBrowse: () => void;
  onOpenPublicRooms: () => void;
  onOpenWatchingRooms: () => void;
  onOpenJoinInput: () => void;
  onJoinPublicRoom: (roomCode: string) => void;
}

function getRomFilename(romPath: string) {
  return romPath.split("/").pop() ?? romPath;
}

function formatRelativePlayedAt(playedAt: number) {
  const diffMs = Date.now() - playedAt;
  const diffMinutes = Math.max(1, Math.floor(diffMs / (1000 * 60)));

  if (diffMinutes < 60) {
    return `${diffMinutes}분 전`;
  }

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours}시간 전`;
  }

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}일 전`;
}

function getRecentOpponentEndReasonCopy(endReason: RecentOpponent["lastEndReason"]) {
  return endReason === "self-left" ? "내가 종료" : "상대방 종료";
}

export default function NetplayMenuScreen({
  quickJoinRooms,
  recentOpponentPreview,
  error,
  onOpenBrowse,
  onOpenPublicRooms,
  onOpenWatchingRooms,
  onOpenJoinInput,
  onJoinPublicRoom,
}: NetplayMenuScreenProps) {
  const hasSecondarySections = quickJoinRooms.length > 0 || recentOpponentPreview.length > 0;

  return (
    <Card className="flex h-full w-full flex-col border-border/70 bg-card/95">
      <CardHeader className="text-center">
        <CardTitle className="font-arcade text-sm text-primary">🌐 온라인 대전</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-3">
        <div
          data-tutorial="netplay-menu-actions"
          className={cn("flex flex-col gap-3", !hasSecondarySections && "flex-1 justify-between")}
        >
          <Button
            variant="outline"
            className={cn("w-full", !hasSecondarySections && "min-h-13")}
            data-tutorial="netplay-open-browse"
            onClick={onOpenBrowse}
          >
            방 만들기
          </Button>
          <Button
            variant="outline"
            className={cn("w-full", !hasSecondarySections && "min-h-13")}
            data-tutorial="netplay-open-public-rooms"
            onClick={onOpenPublicRooms}
          >
            공개 방 둘러보기
          </Button>
          <Button
            variant="outline"
            className={cn("w-full", !hasSecondarySections && "min-h-13")}
            data-tutorial="netplay-open-join"
            onClick={onOpenJoinInput}
          >
            방 참가
          </Button>
          <Button
            variant="outline"
            className={cn("w-full", !hasSecondarySections && "min-h-13")}
            data-tutorial="netplay-open-watch-rooms"
            onClick={onOpenWatchingRooms}
          >
            관전하기
          </Button>
        </div>

        {quickJoinRooms.length > 0 && (
          <div className="rounded-lg border border-border/70 bg-card px-3 py-3">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Globe className="size-3 text-primary" />
                <p className="text-xs font-medium text-foreground">빠른 참가</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-[11px]"
                onClick={onOpenPublicRooms}
              >
                전체 보기
              </Button>
            </div>

            <div className="flex flex-col gap-2">
              {quickJoinRooms.map((room) => (
                <div
                  key={`menu-room-${room.code}`}
                  className="flex items-center gap-2 rounded-lg border border-border/70 bg-muted/10 px-3 py-2"
                >
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <p className="truncate text-xs font-medium text-foreground">
                      {parseRomName(getRomFilename(room.romPath), room.core)}
                    </p>
                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                      <span>{room.hostNickname || "방장"}</span>
                      <span>코드 {room.code}</span>
                    </div>
                  </div>

                  <Button
                    size="sm"
                    className="h-7 px-2 text-[11px]"
                    onClick={() => onJoinPublicRoom(room.code)}
                  >
                    참가
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {recentOpponentPreview.length > 0 && (
          <div className="rounded-lg border border-border/70 bg-card px-3 py-3">
            <div className="mb-3 flex items-center gap-2">
              <MessageSquare className="size-3 text-primary" />
              <p className="text-xs font-medium text-foreground">최근 같이한 상대</p>
            </div>

            <div className="flex flex-col gap-2">
              {recentOpponentPreview.map((opponent) => (
                <div
                  key={`recent-opponent-${opponent.nickname}-${opponent.avatar}`}
                  className="flex items-center gap-2 rounded-lg border border-border/70 bg-muted/10 px-3 py-2"
                >
                  <div className="min-w-0 flex-1">
                    <UserBadge nickname={opponent.nickname} avatar={opponent.avatar} size="sm" />
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                      <span>{opponent.gameName}</span>
                      <span>{formatRelativePlayedAt(opponent.playedAt)}</span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                      <span>{opponent.playCount}번 같이 플레이</span>
                      <span>{getRecentOpponentEndReasonCopy(opponent.lastEndReason)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {error && <p className="text-center text-xs text-destructive-foreground">{error}</p>}
      </CardContent>
    </Card>
  );
}
