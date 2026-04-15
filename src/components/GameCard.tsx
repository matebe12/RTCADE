import { Badge } from "@/components/ui/badge";
import { parseRomName } from "@/lib/game-names";
import { cn } from "@/lib/utils";

interface GameCardProps {
  filename: string;
  core: string;
  systemLabel: string;
  selected?: boolean;
  onClick?: () => void;
}

export function GameCard({ filename, core, systemLabel, selected, onClick }: GameCardProps) {
  const displayName = parseRomName(filename, core);

  return (
    <button
      onClick={onClick}
      className={cn(
        "flex flex-col items-start gap-2 rounded-lg border p-4 text-left transition-all w-full",
        "hover:bg-accent hover:border-primary/30",
        selected ? "bg-primary/10 border-primary/50" : "bg-card border-border",
      )}
    >
      <span className="text-sm font-medium text-card-foreground leading-tight">{displayName}</span>
      <div className="flex items-center gap-2">
        <Badge variant="secondary" className="text-[10px]">
          {systemLabel}
        </Badge>
        <span className="text-[10px] text-muted-foreground">{filename}</span>
      </div>
    </button>
  );
}
