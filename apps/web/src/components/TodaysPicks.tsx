import { Gamepad2, Sparkles } from "lucide-react";
import { useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";

import { SYSTEM_OPTIONS } from "@/components/EmulatorPlayer";
import { ThumbnailImg } from "@/components/ThumbnailImg";
import { parseRomName } from "@/lib/game-names";
import { getFallbackGameThumbnailUrl, getGameThumbnailUrl } from "@/lib/game-thumbnails";
import { pickTodaysGames, type TodaysPick } from "@/lib/game-recommendations";
import { useNetplayLobbyStore, type RomInfo } from "@/stores/useNetplayLobbyStore";
import { Badge } from "@rtcade/ui";

/** 코어 값 → UI 라벨 */
function getCoreLabel(core?: string) {
  if (!core) return null;
  return SYSTEM_OPTIONS.find((system) => system.value === core)?.label ?? core;
}

/** 오늘 날짜를 한국어 형식으로 (예: "8월 4일") */
function formatDateKorean(date: Date): string {
  return `${date.getMonth() + 1}월 ${date.getDate()}일`;
}

interface TodaysPickChipProps {
  pick: TodaysPick;
}

function TodaysPickChip({ pick }: TodaysPickChipProps) {
  const navigate = useNavigate();
  const resetLobby = useNetplayLobbyStore((store) => store.resetLobby);

  const displayName = parseRomName(pick.filename, pick.core);
  const coreLabel = getCoreLabel(pick.core);
  const thumbnailUrl = getGameThumbnailUrl(pick.filename, pick.core);
  const fallbackUrl = getFallbackGameThumbnailUrl(pick.filename, pick.core);
  const thumbnailKey = thumbnailUrl ?? fallbackUrl ?? "";

  const href = `/netplay?entry=create-room&visibility=public&romPath=${encodeURIComponent(pick.path)}&core=${encodeURIComponent(pick.core)}`;

  const handleClick = useCallback(() => {
    resetLobby();
    navigate(href);
  }, [navigate, href, resetLobby]);

  return (
    <button
      type="button"
      onClick={handleClick}
      className="flex shrink-0 flex-col items-center gap-2 rounded-2xl border border-border/70 bg-card/80 p-3 transition-all active:scale-95 hover:border-primary/30 hover:bg-accent min-w-[100px] w-[100px] snap-start"
    >
      <div className="relative size-16 overflow-hidden rounded-xl border border-primary/15 bg-muted/50 shadow-sm">
        {thumbnailUrl || fallbackUrl ? (
          <ThumbnailImg
            key={thumbnailKey}
            src={thumbnailUrl}
            fallback={fallbackUrl}
            alt={displayName}
            className="size-full object-cover"
          />
        ) : (
          <div className="flex size-full items-center justify-center text-primary/50">
            <Gamepad2 className="size-7" />
          </div>
        )}
      </div>
      <span className="w-full truncate text-center text-[11px] font-medium leading-tight text-foreground">
        {displayName}
      </span>
      {coreLabel && (
        <Badge variant="secondary" className="text-[9px] px-1.5 py-0">
          {coreLabel}
        </Badge>
      )}
    </button>
  );
}

interface TodaysPicksProps {
  roms: RomInfo[];
}

/**
 * "오늘의 추천" 섹션.
 * ROM 카탈로그에서 날짜 기반으로 5개의 게임을 추천해 가로 스크롤 칩으로 보여준다.
 * 추천 가능한 게임이 없으면 아무것도 렌더링하지 않는다.
 */
export default function TodaysPicks({ roms }: TodaysPicksProps) {
  const today = useMemo(() => new Date(), []);
  const picks = useMemo(() => pickTodaysGames(roms, today, 5), [roms, today]);

  if (picks.length === 0) return null;

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="size-5 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">오늘의 추천</h2>
        </div>
        <span className="text-xs text-muted-foreground">
          {formatDateKorean(today)}
        </span>
      </div>

      <div className="-mx-4 sm:mx-0">
        <div className="flex gap-2.5 overflow-x-auto px-4 sm:px-0 pb-2 scrollbar-none snap-x snap-mandatory">
          {picks.map((pick) => (
            <TodaysPickChip key={pick.path} pick={pick} />
          ))}
        </div>
      </div>
    </section>
  );
}
