import { useMemo, useState } from "react";
import { ArrowLeft, Loader2, Search } from "lucide-react";

import { SYSTEM_OPTIONS } from "@/components/EmulatorPlayer";
import { GameCard } from "@/components/GameCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { parseRomName, getRomCategory, CATEGORY_INFO, type GameCategory } from "@/lib/game-names";
import type { RecentGame } from "@/lib/user-profile";
import type { RomInfo } from "@/stores/useNetplayLobbyStore";

interface SoloBrowseRomsScreenProps {
  error: string;
  favoriteGames: string[];
  onBack: () => void;
  onSearchQueryChange: (value: string) => void;
  onStartSoloGame: (rom: RomInfo) => void;
  onToggleFavoriteGame: (romPath: string) => void;
  recentGames: RecentGame[];
  roms: RomInfo[];
  searchQuery: string;
  startingRomPath: string | null;
}

function getDisplayName(rom: RomInfo, recentGames: RecentGame[]) {
  return recentGames.find((game) => game.romPath === rom.path)?.displayName;
}

export default function SoloBrowseRomsScreen({
  error,
  favoriteGames,
  onBack,
  onSearchQueryChange,
  onStartSoloGame,
  onToggleFavoriteGame,
  recentGames,
  roms,
  searchQuery,
  startingRomPath,
}: SoloBrowseRomsScreenProps) {
  const isStarting = startingRomPath !== null;
  const filteredRoms = roms.filter((rom) => {
    if (!searchQuery) return true;

    const query = searchQuery.toLowerCase();
    const displayName = getDisplayName(rom, recentGames) ?? parseRomName(rom.filename, rom.core);

    return displayName.toLowerCase().includes(query) || rom.filename.toLowerCase().includes(query);
  });
  const showPersonalizedSections = searchQuery.length === 0;
  const romLookup = new Map(roms.map((rom) => [rom.path, rom]));
  const recentRoms = showPersonalizedSections
    ? recentGames
        .map((game) => {
          const rom = romLookup.get(game.romPath);
          if (!rom) return null;
          return { ...rom, displayName: game.displayName };
        })
        .filter(
          (
            rom,
          ): rom is RomInfo & {
            displayName: string;
          } => rom !== null,
        )
        .slice(0, 3)
    : [];
  const recentRomPaths = new Set(recentRoms.map((rom) => rom.path));
  const favoriteRoms = showPersonalizedSections
    ? favoriteGames
        .map((romPath) => romLookup.get(romPath))
        .filter((rom): rom is RomInfo => rom !== undefined)
        .filter((rom) => !recentRomPaths.has(rom.path))
        .slice(0, 3)
    : [];
  const pinnedRomPaths = new Set([
    ...recentRoms.map((rom) => rom.path),
    ...favoriteRoms.map((rom) => rom.path),
  ]);
  const browseRoms = showPersonalizedSections
    ? filteredRoms.filter((rom) => !pinnedRomPaths.has(rom.path))
    : filteredRoms;

  const isSearching = searchQuery.length > 0;
  const [categoryFilter, setCategoryFilter] = useState<GameCategory | null>(null);

  const categoryCounts = useMemo(() => {
    const counts: Record<GameCategory, number> = {
      fighting: 0, action: 0, shooting: 0, puzzle: 0, sports: 0, etc: 0,
    };
    browseRoms.forEach((rom) => {
      counts[getRomCategory(rom.filename, rom.core)]++;
    });
    return counts;
  }, [browseRoms]);

  const availableCategories = useMemo(
    () =>
      (Object.entries(CATEGORY_INFO) as [GameCategory, (typeof CATEGORY_INFO)[GameCategory]][])
        .sort(([, a], [, b]) => a.order - b.order)
        .filter(([key]) => categoryCounts[key] > 0),
    [categoryCounts],
  );

  const filteredBrowseRoms = useMemo(
    () =>
      categoryFilter
        ? browseRoms.filter((rom) => getRomCategory(rom.filename, rom.core) === categoryFilter)
        : browseRoms,
    [browseRoms, categoryFilter],
  );

  const categoryGroups = useMemo(() => {
    if (isSearching || categoryFilter) return [];
    const groups: Record<GameCategory, RomInfo[]> = {
      fighting: [],
      action: [],
      shooting: [],
      puzzle: [],
      sports: [],
      etc: [],
    };
    browseRoms.forEach((rom) => {
      const cat = getRomCategory(rom.filename, rom.core);
      groups[cat].push(rom);
    });
    return (Object.entries(CATEGORY_INFO) as [GameCategory, (typeof CATEGORY_INFO)[GameCategory]][])
      .sort(([, a], [, b]) => a.order - b.order)
      .map(([key, info]) => ({
        category: key,
        label: info.label,
        icon: info.icon,
        roms: groups[key],
      }))
      .filter((group) => group.roms.length > 0);
  }, [browseRoms, isSearching, categoryFilter]);

  return (
    <Card className="w-full max-w-lg border-border/70 bg-card/95">
      <CardHeader className="flex flex-row items-center gap-3 pb-3">
        <Button variant="ghost" size="icon" className="size-8" onClick={onBack}>
          <ArrowLeft className="size-4" />
        </Button>
        <CardTitle className="text-sm">혼자 플레이할 게임을 선택하세요</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="rounded-lg border border-border/70 bg-background/40 p-3 text-[11px] leading-5 text-muted-foreground">
          서버에 올라온 ROM으로 바로 실행합니다. 상대방 연결 없이 혼자 플레이합니다.
        </div>

        {isStarting && (
          <div className="flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 p-3 text-[11px] text-muted-foreground">
            <Loader2 className="size-3 animate-spin text-primary" />
            선택한 게임을 불러오는 중입니다...
          </div>
        )}

        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="게임 검색..."
            value={searchQuery}
            onChange={(event) => onSearchQueryChange(event.target.value)}
            className="pl-9"
            disabled={isStarting}
          />
        </div>

        {!isSearching && availableCategories.length > 1 && (
          <div className="flex flex-wrap gap-1.5">
            <Button
              type="button"
              variant={categoryFilter === null ? "default" : "outline"}
              size="sm"
              className="h-7 rounded-full px-3 text-[11px]"
              disabled={isStarting}
              onClick={() => setCategoryFilter(null)}
            >
              전체 {browseRoms.length}
            </Button>
            {availableCategories.map(([key, info]) => (
              <Button
                key={key}
                type="button"
                variant={categoryFilter === key ? "default" : "outline"}
                size="sm"
                className="h-7 rounded-full px-3 text-[11px]"
                disabled={isStarting}
                onClick={() => setCategoryFilter(categoryFilter === key ? null : key)}
              >
                {info.icon} {info.label} {categoryCounts[key]}
              </Button>
            ))}
          </div>
        )}
        <ScrollArea className="h-120">
          <div className="flex flex-col gap-2 pr-3">
            {showPersonalizedSections && recentRoms.length > 0 && (
              <div className="flex flex-col gap-2 pb-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-foreground">최근 플레이</p>
                  <span className="text-[11px] text-muted-foreground">바로 다시 시작</span>
                </div>
                {recentRoms.map((rom) => {
                  const sys = SYSTEM_OPTIONS.find((system) => system.value === rom.core);
                  return (
                    <GameCard
                      key={`recent-${rom.path}`}
                      filename={rom.filename}
                      core={rom.core}
                      systemLabel={sys?.label || rom.core}
                      displayName={rom.displayName}
                      favorite={favoriteGames.includes(rom.path)}
                      disabled={isStarting}
                      selected={startingRomPath === rom.path}
                      onToggleFavorite={() => onToggleFavoriteGame(rom.path)}
                      onClick={() => onStartSoloGame(rom)}
                    />
                  );
                })}
              </div>
            )}

            {showPersonalizedSections && favoriteRoms.length > 0 && (
              <div className="flex flex-col gap-2 border-t border-border/70 pb-3 pt-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-foreground">즐겨찾기</p>
                  <span className="text-[11px] text-muted-foreground">자주 하는 게임</span>
                </div>
                {favoriteRoms.map((rom) => {
                  const sys = SYSTEM_OPTIONS.find((system) => system.value === rom.core);
                  return (
                    <GameCard
                      key={`favorite-${rom.path}`}
                      filename={rom.filename}
                      core={rom.core}
                      systemLabel={sys?.label || rom.core}
                      disabled={isStarting}
                      selected={startingRomPath === rom.path}
                      favorite={true}
                      onToggleFavorite={() => onToggleFavoriteGame(rom.path)}
                      onClick={() => onStartSoloGame(rom)}
                    />
                  );
                })}
              </div>
            )}

            {showPersonalizedSections && (recentRoms.length > 0 || favoriteRoms.length > 0) && (
              <div className="flex items-center justify-between border-t border-border/70 pt-3">
                <p className="text-xs font-medium text-foreground">다른 게임</p>
                <span className="text-[11px] text-muted-foreground">{browseRoms.length}개</span>
              </div>
            )}

            {/* 카테고리별 그룹 (검색/필터 없을 때) */}
            {!isSearching && !categoryFilter &&
              categoryGroups.map((group) => {
                return (
                  <div key={group.category} className="flex flex-col gap-2 pb-2">
                    <div className="flex items-center gap-1.5 pt-2">
                      <span className="text-xs">{group.icon}</span>
                      <p className="text-xs font-medium text-foreground">
                        {group.label}
                      </p>
                      <span className="text-[10px] text-muted-foreground">
                        {group.roms.length}
                      </span>
                    </div>
                    {group.roms.map((rom) => {
                      const sys = SYSTEM_OPTIONS.find(
                        (system) => system.value === rom.core,
                      );
                      return (
                        <GameCard
                          key={rom.path}
                          filename={rom.filename}
                          core={rom.core}
                          systemLabel={sys?.label || rom.core}
                          disabled={isStarting}
                          selected={startingRomPath === rom.path}
                          favorite={favoriteGames.includes(rom.path)}
                          onToggleFavorite={() => onToggleFavoriteGame(rom.path)}
                          onClick={() => onStartSoloGame(rom)}
                        />
                      );
                    })}
                  </div>
                );
              })}

            {/* 카테고리 필터 또는 검색 결과 (플랫 리스트) */}
            {(isSearching || categoryFilter) &&
              filteredBrowseRoms.map((rom) => {
                const sys = SYSTEM_OPTIONS.find(
                  (system) => system.value === rom.core,
                );
                return (
                  <GameCard
                    key={rom.path}
                    filename={rom.filename}
                    core={rom.core}
                    systemLabel={sys?.label || rom.core}
                    disabled={isStarting}
                    selected={startingRomPath === rom.path}
                    favorite={favoriteGames.includes(rom.path)}
                    onToggleFavorite={() => onToggleFavoriteGame(rom.path)}
                    onClick={() => onStartSoloGame(rom)}
                  />
                );
              })}

            {(isSearching || categoryFilter ? filteredBrowseRoms : browseRoms).length === 0 && (
              <p className="py-8 text-center text-xs text-muted-foreground">
                {isSearching ? "검색 결과가 없습니다" : categoryFilter ? "해당 카테고리에 게임이 없습니다" : "표시할 다른 게임이 없습니다"}
              </p>
            )}
          </div>
        </ScrollArea>

        {error && <p className="text-center text-xs text-destructive-foreground">{error}</p>}
      </CardContent>
    </Card>
  );
}
