import { useEffect, useState } from "react";
import { ArrowLeft, Globe, Loader2, Lock, Radio, Users } from "lucide-react";

import { SYSTEM_OPTIONS } from "@/components/EmulatorPlayer";
import { UserBadge } from "@/components/UserBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RoomCodeDisplay } from "@/components/RoomCodeDisplay";
import { CATEGORY_INFO, getRomCategory, parseRomName } from "@/lib/game-names";
import { getFallbackGameThumbnailUrl, getGameThumbnailUrl } from "@/lib/game-thumbnails";
import type { RoomLobbyParticipantInfo } from "@/stores/useNetplayLobbyStore";

interface NetplayWaitingScreenProps {
  roomCode: string;
  role: "host" | "guest" | "spectator";
  romFilename: string;
  core: string;
  isPublic?: boolean;
  participants: RoomLobbyParticipantInfo[];
  canStart: boolean;
  canStartSolo?: boolean;
  isReady: boolean;
  spectatorSlotsRemaining: number;
  status: string;
  onBack: () => void;
  onReadyChange: (ready: boolean) => void;
  onStart: () => void;
}

function getWaitingTitle(role: NetplayWaitingScreenProps["role"]) {
  switch (role) {
    case "host":
      return "게임 대기실";
    case "spectator":
      return "관전자 대기실";
    default:
      return "참가 대기실";
  }
}

function getParticipantRoleCopy(role: RoomLobbyParticipantInfo["role"]) {
  switch (role) {
    case "host":
      return "방장";
    case "spectator":
      return "관전자";
    default:
      return "참가자";
  }
}

function getRoleHint(role: NetplayWaitingScreenProps["role"]) {
  switch (role) {
    case "host":
      return "혼자 시작하면 바로 혼자하기로 전환되고, 다른 사람이 입장하면 같이하기로 시작할 수 있습니다.";
    case "spectator":
      return "게임 시작 전까지 준비 완료를 눌러 대기실 합류를 마쳐 주세요.";
    default:
      return "게임 시작 전까지 준비 완료를 눌러 입장 준비를 마쳐 주세요.";
  }
}

export default function NetplayWaitingScreen({
  roomCode,
  role,
  romFilename,
  core,
  isPublic,
  participants,
  canStart,
  canStartSolo = false,
  isReady,
  spectatorSlotsRemaining,
  status,
  onBack,
  onReadyChange,
  onStart,
}: NetplayWaitingScreenProps) {
  const canPressStart = canStart || canStartSolo;
  const displayName = parseRomName(romFilename, core);
  const categoryInfo = CATEGORY_INFO[getRomCategory(romFilename, core)];
  const systemLabel = SYSTEM_OPTIONS.find((option) => option.value === core)?.label ?? core;
  const thumbnailUrl = getGameThumbnailUrl(romFilename, core);
  const fallbackThumbnailUrl = getFallbackGameThumbnailUrl(romFilename, core);
  const [imgError, setImgError] = useState(false);
  const displayThumbnailUrl = imgError || !thumbnailUrl ? fallbackThumbnailUrl : thumbnailUrl;

  useEffect(() => {
    setImgError(false);
  }, [thumbnailUrl, romFilename, core]);

  return (
    <Card className="flex h-full w-full flex-col border-border/70 bg-card/95">
      <CardHeader className="flex flex-row items-center gap-3">
        <Button variant="ghost" size="icon" className="size-8" onClick={onBack}>
          <ArrowLeft className="size-4" />
        </Button>
        <CardTitle className="text-sm">{getWaitingTitle(role)}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p className="text-xs text-muted-foreground">{getRoleHint(role)}</p>
        <RoomCodeDisplay code={roomCode} />

        <div className="overflow-hidden rounded-xl border border-border/70 bg-background/45">
          <div className="grid gap-0 sm:grid-cols-[180px_minmax(0,1fr)]">
            <div className="bg-black/30">
              <img
                src={displayThumbnailUrl}
                alt={displayName}
                loading="lazy"
                onError={displayThumbnailUrl === thumbnailUrl ? () => setImgError(true) : undefined}
                className="aspect-[4/3] h-full w-full object-contain"
              />
            </div>

            <div className="flex min-w-0 flex-col gap-3 p-4">
              <div className="space-y-1">
                <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">선택한 게임</p>
                <h3 className="text-base font-semibold leading-tight text-foreground">{displayName}</h3>
                <p className="truncate text-xs text-muted-foreground">{romFilename}</p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary" className="text-[10px]">
                  {systemLabel}
                </Badge>
                <Badge variant="secondary" className="text-[10px]">
                  {categoryInfo.icon} {categoryInfo.label}
                </Badge>
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                <div className="rounded-lg border border-border/60 bg-background/40 px-3 py-2">
                  <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">방 유형</p>
                  <div className="mt-1 flex items-center gap-1.5 text-xs font-medium text-foreground">
                    {isPublic ? <Globe className="size-3.5 text-primary" /> : <Lock className="size-3.5 text-primary" />}
                    <span>{isPublic ? "공개 방" : "초대 코드 방"}</span>
                  </div>
                </div>

                <div className="rounded-lg border border-border/60 bg-background/40 px-3 py-2">
                  <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">관전자 자리</p>
                  <div className="mt-1 flex items-center gap-1.5 text-xs font-medium text-foreground">
                    <Users className="size-3.5 text-primary" />
                    <span>{spectatorSlotsRemaining}개 남음</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-border/70 bg-background/40 p-3">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs font-medium text-foreground">
              <Radio className="size-3.5 text-primary" />
              입장 멤버
            </div>
            <Badge variant="outline" className="text-[10px]">
              게임 시작 후 역할 변경 불가
            </Badge>
          </div>

          <div className="flex flex-col gap-2">
            {participants.map((participant) => (
              <div
                key={participant.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-background/40 px-3 py-2"
              >
                <div className="min-w-0">
                  <UserBadge
                    nickname={participant.nickname || getParticipantRoleCopy(participant.role)}
                    avatar={participant.avatar || (participant.role === "spectator" ? "👀" : "🎮")}
                    size="sm"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-[10px]">
                    {getParticipantRoleCopy(participant.role)}
                  </Badge>
                  <Badge
                    variant={participant.role === "host" || participant.ready ? "default" : "outline"}
                    className="text-[10px]"
                  >
                    {participant.role === "host" ? "대기실 유지" : participant.ready ? "준비 완료" : "준비 중"}
                  </Badge>
                </div>
              </div>
            ))}

            {participants.length === 1 && (
              <div className="rounded-lg border border-dashed border-border/70 px-3 py-5 text-center text-xs text-muted-foreground">
                아직 다른 참가자가 들어오지 않았습니다.
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2 rounded-lg border border-border/70 bg-background/35 px-3 py-2 text-xs text-muted-foreground">
            <Loader2 className="size-3 animate-spin" />
            <span>
              {status ||
                (canStart
                  ? "모든 준비가 끝났습니다. 게임을 시작할 수 있습니다."
                  : canStartSolo
                    ? "지금 시작하면 혼자하기로 바로 들어갑니다."
                    : "대기실을 준비하는 중...")}
            </span>
          </div>

          {role === "host" ? (
            <Button onClick={onStart} disabled={!canPressStart}>
              {canStartSolo ? "혼자 시작" : "게임 시작"}
            </Button>
          ) : (
            <Button variant={isReady ? "secondary" : "default"} onClick={() => onReadyChange(!isReady)}>
              {isReady ? "준비 취소" : "준비 완료"}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
