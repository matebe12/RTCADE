"use no memo";

import { useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { RomInfo } from "@/stores/useNetplayLobbyStore";
import { SYSTEM_OPTIONS } from "@/components/EmulatorPlayer";
import { GameCard } from "@/components/GameCard";

interface VirtualGameCardListProps {
  roms: RomInfo[];
  favoriteGames: string[];
  onToggleFavoriteGame: (romPath: string) => void;
  previewActionLabel: string;
  recommendedRomPath?: string | null;
  // Netplay mode
  onCreateRoom?: (rom: RomInfo) => void;
  // Solo mode
  onSelectSolo?: (rom: RomInfo) => void;
  disabled?: boolean;
  selectedRomPath?: string | null;
  /** tutorial prefix: "netplay" or "solo" */
  tutorialPrefix?: "netplay" | "solo";
}

/** 한 게임 카드의 예상 높이 (56px 카드 + 8px gap) */
const CARD_HEIGHT = 64;

export function VirtualGameCardList({
  roms,
  favoriteGames,
  onToggleFavoriteGame,
  previewActionLabel,
  recommendedRomPath,
  onCreateRoom,
  onSelectSolo,
  disabled = false,
  selectedRomPath,
  tutorialPrefix = "netplay",
}: VirtualGameCardListProps) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: roms.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => CARD_HEIGHT,
    overscan: 5,
  });

  if (roms.length === 0) return null;

  return (
    <div
      ref={parentRef}
      className="h-full w-full overflow-auto"
      style={{ contain: "strict" }}
    >
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: "100%",
          position: "relative",
        }}
      >
        {virtualizer.getVirtualItems().map((virtualItem) => {
          const rom = roms[virtualItem.index];
          const sys = SYSTEM_OPTIONS.find((s) => s.value === rom.core);
          const isFavorite = favoriteGames.includes(rom.path);
          const isRecommended = rom.path === recommendedRomPath;

          const tutorialKey =
            tutorialPrefix === "solo" ? "solo-primary-game" : "netplay-primary-game";

          return (
            <div
              key={virtualItem.key}
              data-index={virtualItem.index}
              ref={virtualizer.measureElement}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                transform: `translateY(${virtualItem.start}px)`,
              }}
            >
              <div className="pb-2">
                <GameCard
                  filename={rom.filename}
                  core={rom.core}
                  systemLabel={sys?.label || rom.core}
                  previewActionLabel={previewActionLabel}
                  actionDataTutorial={isRecommended ? tutorialKey : undefined}
                  favorite={isFavorite}
                  onToggleFavorite={() => onToggleFavoriteGame(rom.path)}
                  disabled={disabled}
                  selected={selectedRomPath === rom.path}
                  onClick={
                    onCreateRoom
                      ? () => onCreateRoom(rom)
                      : onSelectSolo
                        ? () => onSelectSolo(rom)
                        : undefined
                  }
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
