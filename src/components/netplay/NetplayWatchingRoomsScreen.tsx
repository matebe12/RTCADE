import { ArrowLeft, Eye, RefreshCcw, ScanSearch } from "lucide-react";

import { SYSTEM_OPTIONS } from "@/components/EmulatorPlayer";
import { UserBadge } from "@/components/UserBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { parseRomName } from "@/lib/game-names";
import type { PlayingRoomInfo } from "@/stores/useNetplayLobbyStore";

interface NetplayWatchingRoomsScreenProps {
  rooms: PlayingRoomInfo[];
  status: string;
  error: string;
  onBack: () => void;
  onRefresh: () => void;
  onOpenSpectateCode: () => void;
  onSpectateRoom: (roomCode: string) => void;
}

function getRomFilename(romPath: string) {
  return romPath.split("/").pop() ?? romPath;
}

function formatPlayingSince(startedAt: number) {
  const elapsedMinutes = Math.max(1, Math.floor((Date.now() - startedAt) / 60000));
  if (elapsedMinutes < 60) {
    return `${elapsedMinutes}분째 플레이 중`;
  }

  const elapsedHours = Math.floor(elapsedMinutes / 60);
  return `${elapsedHours}시간째 플레이 중`;
}

export default function NetplayWatchingRoomsScreen({
  rooms,
  status,
  error,
  onBack,
  onRefresh,
  onOpenSpectateCode,
  onSpectateRoom,
}: NetplayWatchingRoomsScreenProps) {
  return (
    <Card className="w-full" data-tutorial="netplay-watch-rooms-panel">
      <CardHeader className="flex flex-row items-center gap-3 pb-3">
        <Button
          variant="ghost"
          size="icon"
          className="size-8"
          data-tutorial="watch-rooms-back"
          onClick={onBack}
        >
          <ArrowLeft className="size-4" />
        </Button>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <CardTitle className="text-sm">관전하기</CardTitle>
          <p className="text-xs text-muted-foreground">
            지금 플레이 중인 공개 방을 관전할 수 있습니다.
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="size-8"
          data-tutorial="watch-rooms-open-code"
          onClick={onOpenSpectateCode}
        >
          <ScanSearch className="size-4" />
        </Button>
        <Button variant="ghost" size="icon" className="size-8" onClick={onRefresh}>
          <RefreshCcw className="size-4" />
        </Button>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="rounded-lg border border-border/70 bg-muted/20 px-3 py-2 text-[11px] text-muted-foreground">
          5초마다 자동 새로고침됩니다. 비공개 방은 코드로만 관전할 수 있습니다.
        </div>
        <ScrollArea className="h-112">
          <div className="flex flex-col gap-2 pr-3">
            {rooms.map((room) => {
              const system = SYSTEM_OPTIONS.find((item) => item.value === room.core);

              return (
                <div
                  key={room.code}
                  className="flex items-center gap-3 rounded-lg border border-border bg-card p-4"
                >
                  <div className="flex min-w-0 flex-1 flex-col gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-medium text-card-foreground">
                        {parseRomName(getRomFilename(room.romPath), room.core)}
                      </p>
                      <Badge variant="secondary" className="text-[10px]">
                        {system?.label || room.core}
                      </Badge>
                      <Badge variant="secondary" className="gap-1 text-[10px]">
                        <Eye className="size-3" />
                        관전자 {room.spectatorCount}명
                      </Badge>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <UserBadge
                        nickname={room.hostNickname || "방장"}
                        avatar={room.hostAvatar || "🎮"}
                        size="sm"
                      />
                      <span className="text-[11px] text-muted-foreground">
                        {formatPlayingSince(room.startedAt)}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                      <span>코드 {room.code}</span>
                      <span>플레이 중</span>
                    </div>
                  </div>

                  <Button size="sm" onClick={() => onSpectateRoom(room.code)}>
                    관전
                  </Button>
                </div>
              );
            })}

            {rooms.length === 0 && (
              <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border/70 px-4 py-10 text-center">
                <p className="text-sm font-medium text-foreground">
                  관전 가능한 공개 방이 없습니다
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  플레이가 시작된 공개 방이 생기면 여기에서 바로 들어갈 수 있습니다.
                </p>
              </div>
            )}
          </div>
        </ScrollArea>
        {status && <p className="text-center text-xs text-muted-foreground">{status}</p>}
        {error && <p className="text-center text-xs text-destructive-foreground">{error}</p>}
      </CardContent>
    </Card>
  );
}
