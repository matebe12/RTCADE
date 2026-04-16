import { ArrowLeft, RefreshCcw } from "lucide-react";

import { SYSTEM_OPTIONS } from "@/components/EmulatorPlayer";
import { UserBadge } from "@/components/UserBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { parseRomName } from "@/lib/game-names";
import type { PublicRoomInfo } from "@/stores/useNetplayLobbyStore";

interface NetplayPublicRoomsScreenProps {
  rooms: PublicRoomInfo[];
  status: string;
  error: string;
  onBack: () => void;
  onRefresh: () => void;
  onJoinRoom: (roomCode: string) => void;
}

function getRomFilename(romPath: string) {
  return romPath.split("/").pop() ?? romPath;
}

export default function NetplayPublicRoomsScreen({
  rooms,
  status,
  error,
  onBack,
  onRefresh,
  onJoinRoom,
}: NetplayPublicRoomsScreenProps) {
  return (
    <Card className="w-full max-w-lg">
      <CardHeader className="flex flex-row items-center gap-3 pb-3">
        <Button variant="ghost" size="icon" className="size-8" onClick={onBack}>
          <ArrowLeft className="size-4" />
        </Button>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <CardTitle className="text-sm">공개 방 둘러보기</CardTitle>
          <p className="text-xs text-muted-foreground">지금 바로 참가 가능한 대기 중 방입니다.</p>
        </div>
        <Button variant="ghost" size="icon" className="size-8" onClick={onRefresh}>
          <RefreshCcw className="size-4" />
        </Button>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="rounded-lg border border-border/70 bg-muted/20 px-3 py-2 text-[11px] text-muted-foreground">
          5초마다 자동 새로고침됩니다. 마음에 드는 방이 있으면 바로 참가하면 됩니다.
        </div>
        <ScrollArea className="h-112">
          <div className="flex flex-col gap-2 pr-3">
            {rooms.map((room) => {
              const sys = SYSTEM_OPTIONS.find((system) => system.value === room.core);

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
                        {sys?.label || room.core}
                      </Badge>
                      <Badge variant="secondary" className="text-[10px]">
                        코드 {room.code}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <UserBadge
                        nickname={room.hostNickname || "호스트"}
                        avatar={room.hostAvatar || "🎮"}
                        size="sm"
                      />
                      <span className="text-[11px] text-muted-foreground">참가자 1/2</span>
                    </div>
                  </div>

                  <Button size="sm" onClick={() => onJoinRoom(room.code)}>
                    참가
                  </Button>
                </div>
              );
            })}

            {rooms.length === 0 && (
              <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border/70 px-4 py-10 text-center">
                <p className="text-sm font-medium text-foreground">열려 있는 공개 방이 없습니다</p>
                <p className="mt-2 text-xs text-muted-foreground">
                  직접 공개 방을 만들거나 잠시 후 다시 새로고침해 보세요.
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
