import { useCallback, useEffect, useState } from "react";
import { Gamepad2, Star } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { parseRomName } from "@/lib/game-names";
import { getFallbackGameThumbnailUrl, getGameThumbnailUrl } from "@/lib/game-thumbnails";
import { cn } from "@/lib/utils";

interface GameCardProps {
  filename: string;
  core: string;
  systemLabel: string;
  displayName?: string;
  dataTutorial?: string;
  disabled?: boolean;
  selected?: boolean;
  onClick?: () => void;
  favorite?: boolean;
  onToggleFavorite?: () => void;
}

export function GameCard({
  filename,
  core,
  systemLabel,
  displayName,
  dataTutorial,
  disabled = false,
  selected,
  onClick,
  favorite = false,
  onToggleFavorite,
}: GameCardProps) {
  const resolvedDisplayName = displayName ?? parseRomName(filename, core);
  const thumbnailUrl = getGameThumbnailUrl(filename, core);
  const fallbackThumbnailUrl = getFallbackGameThumbnailUrl(filename, core);
  const [imgError, setImgError] = useState(false);
  const displayThumbnailUrl = imgError || !thumbnailUrl ? fallbackThumbnailUrl : thumbnailUrl;

  const handleImgError = useCallback(() => setImgError(true), []);

  useEffect(() => {
    setImgError(false);
  }, [thumbnailUrl]);

  return (
    <div
      data-tutorial={dataTutorial}
      className={cn(
        "flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-all",
        !disabled && "hover:bg-accent hover:border-primary/30",
        disabled && "cursor-not-allowed opacity-70",
        selected ? "bg-primary/10 border-primary/50" : "bg-card border-border",
      )}
    >
      {/* 썸네일 */}
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className="relative size-14 shrink-0 overflow-hidden rounded-md bg-muted"
      >
        {displayThumbnailUrl ? (
          <img
            src={displayThumbnailUrl}
            alt={resolvedDisplayName}
            loading="lazy"
            onError={displayThumbnailUrl === thumbnailUrl ? handleImgError : undefined}
            className="size-full object-cover"
          />
        ) : (
          <span className="flex size-full items-center justify-center text-muted-foreground">
            <Gamepad2 className="size-6" />
          </span>
        )}
      </button>

      {/* 텍스트 */}
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className="flex min-w-0 flex-1 flex-col items-start gap-1.5 text-left"
      >
        <span className="text-sm font-medium leading-tight text-card-foreground">
          {resolvedDisplayName}
        </span>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary" className="text-[10px]">
            {systemLabel}
          </Badge>
          <span className="text-[10px] text-muted-foreground">{filename}</span>
        </div>
      </button>

      {onToggleFavorite && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8 shrink-0 rounded-full"
          disabled={disabled}
          aria-label={favorite ? "즐겨찾기 해제" : "즐겨찾기 추가"}
          onClick={onToggleFavorite}
        >
          <Star
            className={cn(
              "size-4 transition-colors",
              favorite ? "fill-primary text-primary" : "text-muted-foreground",
            )}
          />
        </Button>
      )}
    </div>
  );
}
