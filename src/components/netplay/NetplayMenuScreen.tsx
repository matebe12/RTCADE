import { Globe, Lock, MessageSquare } from "lucide-react";

import { UserBadge } from "@/components/UserBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { parseRomName } from "@/lib/game-names";
import type { RecentOpponent } from "@/lib/user-profile";
import type { PublicRoomInfo } from "@/stores/useNetplayLobbyStore";

interface NetplayMenuScreenProps {
  quickJoinRooms: PublicRoomInfo[];
  recentOpponentPreview: RecentOpponent[];
  error: string;
  replayOpponentTarget: RecentOpponent | null;
  onOpenBrowse: () => void;
  onOpenPublicRooms: () => void;
  onOpenJoinInput: () => void;
  onJoinPublicRoom: (roomCode: string) => void;
  onReplayTargetChange: (opponent: RecentOpponent | null) => void;
  onReplayRecentOpponent: (opponent: RecentOpponent, isPublic: boolean) => void;
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
  return endReason === "self-left" ? "내가 종료" : "상대가 종료";
}

export default function NetplayMenuScreen({
  quickJoinRooms,
  recentOpponentPreview,
  error,
  replayOpponentTarget,
  onOpenBrowse,
  onOpenPublicRooms,
  onOpenJoinInput,
  onJoinPublicRoom,
  onReplayTargetChange,
  onReplayRecentOpponent,
}: NetplayMenuScreenProps) {
  return (
    <Card className="w-full max-w-sm">
      <CardHeader className="text-center">
        <CardTitle className="font-arcade text-sm text-primary">🌐 NETPLAY</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <Button variant="outline" className="w-full" onClick={onOpenBrowse}>
          방 만들기
        </Button>
        <Button variant="outline" className="w-full" onClick={onOpenPublicRooms}>
          공개 방 둘러보기
        </Button>
        <Button variant="outline" className="w-full" onClick={onOpenJoinInput}>
          방 참가
        </Button>

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
                      <span>{room.hostNickname || "호스트"}</span>
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

                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 px-2 text-[11px]"
                    onClick={() => onReplayTargetChange(opponent)}
                  >
                    다시 만나기
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {error && <p className="text-center text-xs text-destructive-foreground">{error}</p>}

        <Dialog
          open={replayOpponentTarget !== null}
          onOpenChange={(open) => {
            if (!open) {
              onReplayTargetChange(null);
            }
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>같은 게임으로 다시 열기</DialogTitle>
              <DialogDescription>
                {replayOpponentTarget
                  ? `${replayOpponentTarget.nickname}님과 했던 ${replayOpponentTarget.gameName} 방을 어떤 방식으로 열지 선택하세요.`
                  : "방 공개 여부를 선택하세요."}
              </DialogDescription>
            </DialogHeader>

            {replayOpponentTarget && (
              <div className="rounded-lg border border-border/70 bg-muted/10 px-4 py-3 text-sm text-foreground">
                <div className="flex items-center justify-between gap-3">
                  <UserBadge
                    nickname={replayOpponentTarget.nickname}
                    avatar={replayOpponentTarget.avatar}
                    size="sm"
                  />
                  <Badge variant="secondary" className="text-[10px]">
                    {replayOpponentTarget.playCount}번 플레이
                  </Badge>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                  <span>{replayOpponentTarget.gameName}</span>
                  <span>{formatRelativePlayedAt(replayOpponentTarget.playedAt)}</span>
                  <span>{getRecentOpponentEndReasonCopy(replayOpponentTarget.lastEndReason)}</span>
                </div>
              </div>
            )}

            <DialogFooter className="gap-2 sm:justify-between sm:space-x-0">
              <Button
                variant="outline"
                className="w-full sm:flex-1"
                onClick={() => {
                  if (replayOpponentTarget) {
                    onReplayRecentOpponent(replayOpponentTarget, false);
                  }
                }}
              >
                <Lock className="size-4" />
                초대 코드 방
              </Button>
              <Button
                className="w-full sm:flex-1"
                onClick={() => {
                  if (replayOpponentTarget) {
                    onReplayRecentOpponent(replayOpponentTarget, true);
                  }
                }}
              >
                <Globe className="size-4" />
                공개 방
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
