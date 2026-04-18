import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { parseRomName } from "@/lib/game-names";
import { cn } from "@/lib/utils";
import { Star } from "lucide-react";

interface GameCardProps {
  filename: string;
  core: string;
  systemLabel: string;
  displayName?: string;
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
  disabled = false,
  selected,
  onClick,
  favorite = false,
  onToggleFavorite,
}: GameCardProps) {
  const resolvedDisplayName = displayName ?? parseRomName(filename, core);

  return (
    <div
      className={cn(
        "flex w-full items-start gap-3 rounded-lg border p-4 text-left transition-all",
        !disabled && "hover:bg-accent hover:border-primary/30",
        disabled && "cursor-not-allowed opacity-70",
        selected ? "bg-primary/10 border-primary/50" : "bg-card border-border",
      )}
    >
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className="flex min-w-0 flex-1 flex-col items-start gap-2 text-left"
      >
        <span className="text-sm font-medium text-card-foreground leading-tight">
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
