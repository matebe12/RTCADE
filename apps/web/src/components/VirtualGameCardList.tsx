"use no memo";

import { type ReactNode, useRef } from "react";
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
  onCreateRoom?: (rom: RomInfo) => void;
  onSelectSolo?: (rom: RomInfo) => void;
  disabled?: boolean;
  selectedRomPath?: string | null;
  tutorialPrefix?: "netplay" | "solo";
  /** 가상 스크롤 위쪽에 렌더링할 헤더 요소 (카테고리 칩, 검색창 등) */
  header?: ReactNode;
  /** 고정 높이 (기본: 부모 컨테이너 높이 자동 계산) */
  height?: number;
}

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
  header,
  height,
}: VirtualGameCardListProps) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: roms.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => CARD_HEIGHT,
    overscan: 5,
  });

  return (
    <div
      ref={parentRef}
      className="w-full overflow-auto"
      style={{ height: height ?? "100%", contain: "strict" }}
    >
      {header}
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
              <div className="pr-1" style={{ paddingBottom: 8 }}>
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
