import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Globe, Loader2, Lock, Radio, Search, Users } from "lucide-react";

import { SYSTEM_OPTIONS } from "@/components/EmulatorPlayer";
import { UserBadge } from "@/components/UserBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { RoomCodeDisplay } from "@/components/RoomCodeDisplay";
import { CATEGORY_INFO, getRomCategory, parseRomName } from "@/lib/game-names";
import { getFallbackGameThumbnailUrl, getGameThumbnailUrl } from "@/lib/game-thumbnails";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { RomInfo, RoomLobbyParticipantInfo } from "@/stores/useNetplayLobbyStore";

interface NetplayWaitingScreenProps {
  roomCode: string;
  role: "host" | "guest" | "spectator";
  romFilename: string;
  romPath: string;
  core: string;
  biosPath?: string;
  isPublic?: boolean;
  participants: RoomLobbyParticipantInfo[];
  canStart: boolean;
  canStartSolo?: boolean;
  isReady: boolean;
  spectatorSlotsRemaining: number;
  status: string;
  availableRoomRoms?: RomInfo[];
  roomGamePickerOpen?: boolean;
  roomGamePickerLoading?: boolean;
  onBack: () => void;
  onReadyChange: (ready: boolean) => void;
  onOpenRoomGamePicker?: () => void;
  onCloseRoomGamePicker?: () => void;
  onChangeRoomGame?: (rom: RomInfo) => void;
  onKickParticipant?: (participantId: string) => void;
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
  romPath,
  core,
  biosPath,
  isPublic,
  participants,
  canStart,
  canStartSolo = false,
  isReady,
  spectatorSlotsRemaining,
  status,
  availableRoomRoms = [],
  roomGamePickerOpen = false,
  roomGamePickerLoading = false,
  onBack,
  onReadyChange,
  onOpenRoomGamePicker,
  onCloseRoomGamePicker,
  onChangeRoomGame,
  onKickParticipant,
  onStart,
}: NetplayWaitingScreenProps) {
  const canPressStart = canStart || canStartSolo;
  const canManageRoom = role === "host";
  const displayName = parseRomName(romFilename, core);
  const categoryInfo = CATEGORY_INFO[getRomCategory(romFilename, core)];
  const systemLabel = SYSTEM_OPTIONS.find((option) => option.value === core)?.label ?? core;
  const thumbnailUrl = getGameThumbnailUrl(romFilename, core);
  const fallbackThumbnailUrl = getFallbackGameThumbnailUrl(romFilename, core);
  const [imgError, setImgError] = useState(false);
  const [roomGameQuery, setRoomGameQuery] = useState("");
  const [kickTarget, setKickTarget] = useState<RoomLobbyParticipantInfo | null>(null);
  const displayThumbnailUrl = imgError || !thumbnailUrl ? fallbackThumbnailUrl : thumbnailUrl;

  const filteredRoomRoms = useMemo(() => {
    const normalizedQuery = roomGameQuery.trim().toLowerCase();

    if (!normalizedQuery) {
      return availableRoomRoms;
    }

    return availableRoomRoms.filter((rom) => {
      const normalizedName = parseRomName(rom.filename, rom.core).toLowerCase();
      return normalizedName.includes(normalizedQuery) || rom.filename.toLowerCase().includes(normalizedQuery);
    });
  }, [availableRoomRoms, roomGameQuery]);

  useEffect(() => {
    setImgError(false);
  }, [thumbnailUrl, romFilename, core]);

  useEffect(() => {
    if (!roomGamePickerOpen) {
      setRoomGameQuery("");
    }
  }, [roomGamePickerOpen]);

  return (
    <>
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

                {canManageRoom && (
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={onOpenRoomGamePicker}
                      disabled={roomGamePickerLoading}
                    >
                      {roomGamePickerLoading ? <Loader2 className="size-4 animate-spin" /> : null}
                      게임 변경
                    </Button>
                  </div>
                )}

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
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <Badge variant="secondary" className="text-[10px]">
                      {getParticipantRoleCopy(participant.role)}
                    </Badge>
                    <Badge
                      variant={participant.role === "host" || participant.ready ? "default" : "outline"}
                      className="text-[10px]"
                    >
                      {participant.role === "host" ? "대기실 유지" : participant.ready ? "준비 완료" : "준비 중"}
                    </Badge>
                    {canManageRoom && participant.role !== "host" && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => setKickTarget(participant)}
                      >
                        강퇴
                      </Button>
                    )}
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

      <Dialog
        open={roomGamePickerOpen}
        onOpenChange={(open) => {
          if (!open) {
            onCloseRoomGamePicker?.();
          }
        }}
      >
        <DialogContent className="max-w-3xl border-border/70 bg-card/95">
          <DialogHeader>
            <DialogTitle>대기실 게임 변경</DialogTitle>
            <DialogDescription>
              다른 게임으로 바꾸면 참가자와 관전자의 준비 상태가 다시 초기화됩니다.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={roomGameQuery}
                onChange={(event) => setRoomGameQuery(event.target.value)}
                placeholder="게임 이름이나 파일명으로 검색"
                className="pl-9"
              />
            </div>

            <div className="overflow-hidden rounded-xl border border-border/70 bg-background/40">
              <ScrollArea className="h-[420px]">
                <div className="grid gap-3 p-3">
                  {roomGamePickerLoading ? (
                    <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
                      <Loader2 className="size-4 animate-spin" />
                      게임 목록을 불러오는 중...
                    </div>
                  ) : filteredRoomRoms.length > 0 ? (
                    filteredRoomRoms.map((rom) => {
                      const romDisplayName = parseRomName(rom.filename, rom.core);
                      const romSystemLabel =
                        SYSTEM_OPTIONS.find((option) => option.value === rom.core)?.label ?? rom.core;
                      const romCategoryInfo = CATEGORY_INFO[getRomCategory(rom.filename, rom.core)];
                      const romThumbnailUrl =
                        getGameThumbnailUrl(rom.filename, rom.core) ??
                        getFallbackGameThumbnailUrl(rom.filename, rom.core);
                      const isCurrentGame =
                        rom.path === romPath &&
                        rom.core === core &&
                        (rom.bios ?? undefined) === (biosPath ?? undefined);

                      return (
                        <div
                          key={rom.path}
                          className="flex items-center gap-3 rounded-lg border border-border/60 bg-background/50 p-3"
                        >
                          <img
                            src={romThumbnailUrl}
                            alt={romDisplayName}
                            loading="lazy"
                            onError={(event) => {
                              const fallbackThumbnail = getFallbackGameThumbnailUrl(rom.filename, rom.core);
                              if (event.currentTarget.src !== fallbackThumbnail) {
                                event.currentTarget.src = fallbackThumbnail;
                              }
                            }}
                            className="size-16 rounded-md bg-black/30 object-cover"
                          />

                          <div className="min-w-0 flex-1 space-y-1">
                            <p className="truncate text-sm font-medium text-foreground">{romDisplayName}</p>
                            <p className="truncate text-xs text-muted-foreground">{rom.filename}</p>
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge variant="secondary" className="text-[10px]">
                                {romSystemLabel}
                              </Badge>
                              <Badge variant="secondary" className="text-[10px]">
                                {romCategoryInfo.icon} {romCategoryInfo.label}
                              </Badge>
                            </div>
                          </div>

                          <Button
                            type="button"
                            size="sm"
                            variant={isCurrentGame ? "secondary" : "default"}
                            disabled={isCurrentGame}
                            onClick={() => onChangeRoomGame?.(rom)}
                          >
                            {isCurrentGame ? "현재 게임" : "이 게임으로 변경"}
                          </Button>
                        </div>
                      );
                    })
                  ) : (
                    <div className="py-16 text-center text-sm text-muted-foreground">
                      검색 결과가 없습니다.
                    </div>
                  )}
                </div>
              </ScrollArea>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onCloseRoomGamePicker}>
              닫기
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={kickTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setKickTarget(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>참가자를 대기실에서 내보낼까요?</AlertDialogTitle>
            <AlertDialogDescription>
              {kickTarget
                ? `${kickTarget.nickname || getParticipantRoleCopy(kickTarget.role)} 님을 강퇴하면 다시 입장해야 합니다.`
                : "선택한 참가자를 강퇴합니다."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (kickTarget) {
                  onKickParticipant?.(kickTarget.id);
                }
                setKickTarget(null);
              }}
            >
              강퇴하기
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
