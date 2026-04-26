import { useCallback, useEffect, useState } from "react";
import { Gamepad2, Star } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { parseRomName } from "@/lib/game-names";
import { getFallbackGameThumbnailUrl, getGameThumbnailUrl } from "@/lib/game-thumbnails";
import { cn } from "@/lib/utils";

interface GameCardProps {
  filename: string;
  core: string;
  systemLabel: string;
  displayName?: string;
  dataTutorial?: string;
  actionDataTutorial?: string;
  disabled?: boolean;
  selected?: boolean;
  onClick?: () => void;
  previewActionLabel?: string;
  favorite?: boolean;
  onToggleFavorite?: () => void;
}

export function GameCard({
  filename,
  core,
  systemLabel,
  displayName,
  dataTutorial,
  actionDataTutorial,
  disabled = false,
  selected,
  onClick,
  previewActionLabel = "플레이",
  favorite = false,
  onToggleFavorite,
}: GameCardProps) {
  const resolvedDisplayName = displayName ?? parseRomName(filename, core);
  const thumbnailUrl = getGameThumbnailUrl(filename, core);
  const fallbackThumbnailUrl = getFallbackGameThumbnailUrl(filename, core);
  const [imgError, setImgError] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const displayThumbnailUrl = imgError || !thumbnailUrl ? fallbackThumbnailUrl : thumbnailUrl;
  const previewDescription =
    previewActionLabel === "방 만들기"
      ? "썸네일을 크게 보고 선택하면 바로 새 방이 만들어집니다."
      : "썸네일을 크게 보고 바로 시작할 수 있습니다.";

  const handleImgError = useCallback(() => setImgError(true), []);
  const handlePreviewAction = useCallback(() => {
    setPreviewOpen(false);
    onClick?.();
  }, [onClick]);

  useEffect(() => {
    setImgError(false);
  }, [thumbnailUrl]);

  return (
    <>
      <div
        data-tutorial={dataTutorial}
        className={cn(
          "flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-all",
          !disabled && "hover:bg-accent hover:border-primary/30",
          disabled && "cursor-not-allowed opacity-70",
          selected ? "bg-primary/10 border-primary/50" : "bg-card border-border",
        )}
      >
        <button
          type="button"
          onClick={() => setPreviewOpen(true)}
          disabled={disabled}
          className="relative size-14 shrink-0 overflow-hidden rounded-md bg-muted"
          aria-label={`${resolvedDisplayName} 썸네일 크게 보기`}
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
          <span className="absolute inset-x-0 bottom-0 bg-black/55 px-1 py-0.5 text-[9px] font-medium text-white">
            크게 보기
          </span>
        </button>

        <button
          type="button"
          onClick={onClick}
          disabled={disabled}
          data-tutorial={actionDataTutorial}
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

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-3xl overflow-hidden border-border/80 bg-card/95 p-0 shadow-2xl backdrop-blur-xl sm:rounded-2xl">
          <div className="border-b border-border/70 bg-[radial-gradient(circle_at_top_left,rgba(0,160,255,0.16),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(255,135,61,0.12),transparent_28%)] p-4 sm:p-5">
            <div className="overflow-hidden rounded-2xl border border-primary/20 bg-black/40 shadow-lg shadow-primary/10">
              {displayThumbnailUrl ? (
                <img
                  src={displayThumbnailUrl}
                  alt={resolvedDisplayName}
                  className="aspect-[4/3] w-full object-contain"
                />
              ) : (
                <div className="flex aspect-[4/3] w-full items-center justify-center text-muted-foreground">
                  <Gamepad2 className="size-16" />
                </div>
              )}
            </div>
          </div>

          <div className="space-y-4 p-5">
            <DialogHeader className="space-y-2 text-left">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary" className="text-[10px]">
                  {systemLabel}
                </Badge>
                <span className="text-xs text-muted-foreground">{filename}</span>
              </div>
              <DialogTitle className="text-xl leading-tight text-foreground">
                {resolvedDisplayName}
              </DialogTitle>
              <DialogDescription>{previewDescription}</DialogDescription>
            </DialogHeader>

            <DialogFooter className="gap-2 border-t border-border/70 pt-4 sm:justify-between sm:space-x-0">
              <Button type="button" variant="outline" onClick={() => setPreviewOpen(false)}>
                닫기
              </Button>
              <Button type="button" onClick={handlePreviewAction} disabled={disabled || !onClick}>
                <Gamepad2 className="size-4" />
                {previewActionLabel}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
