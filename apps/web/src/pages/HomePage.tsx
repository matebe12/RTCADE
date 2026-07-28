import { Gamepad2, Play, Users, Zap } from "lucide-react";
import { useCallback, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";

import { SYSTEM_OPTIONS } from "@/components/EmulatorPlayer";
import { ThumbnailImg } from "@/components/ThumbnailImg";
import { useOperationsStats } from "@/hooks/useOperationsStats";
import { parseRomName } from "@/lib/game-names";
import { getFallbackGameThumbnailUrl, getGameThumbnailUrl } from "@/lib/game-thumbnails";
import type { PopularGameSummary } from "@/lib/operations-api";
import { usePageSeo } from "@/lib/seo";
import { getRecentGames, getUserProfile } from "@/lib/user-profile";
import { useNetplayLobbyStore } from "@/stores/useNetplayLobbyStore";
import { Badge, Button } from "@rtcade/ui";

// 고퀄 조이스틱 — 받침대·소켓 고정, 레버+공이 좌우 흔들림
function SpinningJoystick() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {/* 받침대 본체 */}
      <path d="M2 18a2.5 2.5 0 0 1 2.5-2.5h15A2.5 2.5 0 0 1 22 18v1a2.5 2.5 0 0 1-2.5 2.5h-15A2.5 2.5 0 0 1 2 19v-1z" />
      {/* 받침대 상단 테두리 라인 (입체감) */}
      <path d="M4 15.5 Q12 14.5 20 15.5" />
      {/* 소켓 (레버 연결부) */}
      <ellipse cx="12" cy="15.5" rx="2.8" ry="1.1" />

      {/* 레버 그룹 — 소켓(12, 15.5) 기준 좌우 흔들림 */}
      <g
        style={{
          transformOrigin: "12px 15.5px",
          animation: "joystick-swing 0.8s ease-in-out infinite",
        }}
      >
        {/* 스틱 본체 — 두 선으로 튜브 입체감 */}
        <path d="M10.8 15.5 L10.2 9.5" />
        <path d="M13.2 15.5 L13.8 9.5" />
        {/* 스틱 끝 공 (채워진 원 + 테두리) */}
        <circle cx="12" cy="7" r="3.2" fill="currentColor" stroke="currentColor" strokeWidth="1.5" />
        {/* 공 하이라이트 (광택 느낌) */}
        <path
          d="M10.5 5.6 Q12 4.4 13.5 5.6"
          stroke="white"
          strokeWidth="1"
          strokeOpacity="0.45"
          fill="none"
        />
        {/* 스틱↔공 연결 칼라(collar) */}
        <path d="M10.5 9.5 Q12 10.2 13.5 9.5" />
      </g>
    </svg>
  );
}

interface HomePageProps {
  hasProfile: boolean;
}

type PopularGamesPeriod = "today" | "weekly" | "monthly";

const numberFormatter = new Intl.NumberFormat("ko-KR");

const relativeTimeFormatter = new Intl.DateTimeFormat("ko-KR", {
  hour: "2-digit",
  minute: "2-digit",
  month: "short",
  day: "numeric",
});

function getFilename(romPath?: string) {
  if (!romPath) return null;
  return romPath.split("/").pop() ?? romPath;
}

function getCoreLabel(core?: string) {
  if (!core) return null;
  return SYSTEM_OPTIONS.find((system) => system.value === core)?.label ?? core;
}

function PopularGameChip({ game }: { game: PopularGameSummary }) {
  const navigate = useNavigate();
  const resetLobby = useNetplayLobbyStore((store) => store.resetLobby);

  const filename = getFilename(game.romPath);
  const displayName = filename && game.core ? parseRomName(filename, game.core) : game.gameName;
  const coreLabel = getCoreLabel(game.core);
  const thumbnailUrl = filename && game.core ? getGameThumbnailUrl(filename, game.core) : null;
  const fallbackUrl = filename && game.core ? getFallbackGameThumbnailUrl(filename, game.core) : null;
  const thumbnailKey = thumbnailUrl ?? fallbackUrl ?? "";

  const href =
    game.romPath && game.core
      ? `/netplay?entry=create-room&visibility=public&romPath=${encodeURIComponent(game.romPath)}&core=${encodeURIComponent(game.core)}`
      : "/netplay";

  const handleClick = useCallback(() => {
    resetLobby();
    navigate(href);
  }, [navigate, href, resetLobby]);

  return (
    <button
      type="button"
      onClick={handleClick}
      className="flex shrink-0 flex-col items-center gap-2 rounded-2xl border border-border/70 bg-card/80 p-3 transition-all active:scale-95 hover:border-primary/30 hover:bg-accent min-w-[100px] w-[100px]"
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

export default function HomePage({ hasProfile }: HomePageProps) {
  usePageSeo({
    title: "홈",
    description:
      "브라우저에서 레트로 게임을 같이하거나 혼자 플레이할 수 있어요. 인기 게임을 바로 확인하고 시작해보세요.",
  });

  const { stats } = useOperationsStats();
  const profile = hasProfile ? getUserProfile() : null;
  const recentGames = getRecentGames();
  const recentGame = recentGames[0] ?? null;
  const [activePeriod, setActivePeriod] = useState<PopularGamesPeriod>("today");

  const connectedPlayers = stats?.connectedPlayers ?? 0;
  const todayGames = stats?.todayGames ?? 0;
  const totalVisitors = stats?.totalVisitors ?? 0;
  const totalGames = stats?.totalGames ?? 0;
  const todayPopularGames = stats?.todayPopularGames ?? [];
  const weeklyPopularGames = stats?.weeklyPopularGames ?? [];
  const monthlyPopularGames = stats?.monthlyPopularGames ?? [];

  const periodOptions: Array<{
    key: PopularGamesPeriod;
    label: string;
    games: PopularGameSummary[];
  }> = [
    { key: "today", label: "오늘", games: todayPopularGames },
    { key: "weekly", label: "이번 주", games: weeklyPopularGames },
    { key: "monthly", label: "이번 달", games: monthlyPopularGames },
  ];

  const activeGames =
    periodOptions.find((p) => p.key === activePeriod)?.games ?? todayPopularGames;

  return (
    <div className="flex w-full flex-col gap-8 pb-8">
      {/* Hero Section */}
      <section className="relative overflow-hidden rounded-[28px] border border-primary/25 bg-gradient-to-br from-primary/10 via-card/90 to-card/80 px-6 py-10 text-center shadow-sm shadow-primary/10 sm:px-10 sm:py-14">
        <div className="relative z-10 mx-auto flex max-w-md flex-col items-center gap-4">
          <h1 className="font-arcade text-lg text-primary tracking-wide">RTCADE</h1>
          <p className="text-sm leading-6 text-muted-foreground">
            브라우저에서 바로 실행되는 레트로 게임.
            <br className="hidden sm:block" /> 친구와 함께하거나 혼자서도 즐길 수 있어요.
          </p>

          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span>
              총 방문자{" "}
              <strong className="tabular-nums text-foreground">
                {stats ? `${numberFormatter.format(totalVisitors)}명` : "--"}
              </strong>
            </span>
            <span className="text-border" aria-hidden>·</span>
            <span>
              총 플레이{" "}
              <strong className="tabular-nums text-foreground">
                {stats ? `${numberFormatter.format(totalGames)}판` : "--"}
              </strong>
            </span>
          </div>

          <Button asChild size="lg" className="mt-2 gap-2 font-bold tracking-tight shadow-lg shadow-primary/40">
            <NavLink to="/netplay" data-tutorial="home-play-start">
              <Play className="size-4" />
              플레이 시작하기
              <SpinningJoystick />
            </NavLink>
          </Button>
        </div>
      </section>

      {/* Compact Stats Row */}
      <div className="flex gap-3">
        <div className="flex flex-1 items-center gap-3 rounded-2xl border border-border/70 bg-card/80 px-4 py-3.5">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
            <Users className="size-5 text-primary" />
          </div>
          <div className="min-w-0">
            <div className="text-lg font-semibold tabular-nums text-foreground">
              {stats ? `${numberFormatter.format(connectedPlayers)}명` : "--"}
            </div>
            <div className="text-xs text-muted-foreground">접속 중</div>
          </div>
          <span className="ml-auto size-2 shrink-0 rounded-full bg-emerald-500" title="실시간" />
        </div>

        <div className="flex flex-1 items-center gap-3 rounded-2xl border border-border/70 bg-card/80 px-4 py-3.5">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
            <Zap className="size-5 text-primary" />
          </div>
          <div className="min-w-0">
            <div className="text-lg font-semibold tabular-nums text-foreground">
              {stats ? `${numberFormatter.format(todayGames)}판` : "--"}
            </div>
            <div className="text-xs text-muted-foreground">오늘 플레이</div>
          </div>
          <span className="ml-auto size-2 shrink-0 rounded-full bg-emerald-500" title="실시간" />
        </div>
      </div>

      {/* Popular Games */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">인기 게임</h2>
          <div className="flex gap-1.5">
            {periodOptions.map(({ key, label }) => (
              <Button
                key={key}
                type="button"
                size="sm"
                variant={key === activePeriod ? "default" : "outline"}
                className="h-8 rounded-full px-3 text-xs"
                onClick={() => setActivePeriod(key)}
              >
                {label}
              </Button>
            ))}
          </div>
        </div>

        {activeGames.length > 0 ? (
          <div className="-mx-4 sm:mx-0">
            <div className="flex gap-2.5 overflow-x-auto px-4 sm:px-0 pb-2 scrollbar-none snap-x snap-mandatory">
              {activeGames.map((game, index) => (
                <PopularGameChip
                  key={`${activePeriod}-${game.gameName}-${game.romPath ?? index}-${game.core ?? "unknown"}`}
                  game={game}
                />
              ))}
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-border/70 bg-background/50 px-4 py-10 text-center text-sm text-muted-foreground">
            아직 기록이 쌓이지 않았어요. 게임을 시작하면 여기에 인기 게임이 표시됩니다.
          </div>
        )}
      </section>

      {/* Recent Activity (only if has profile and played before) */}
      {profile && recentGame && (
        <RecentActivityBar recentGame={recentGame} />
      )}
    </div>
  );
}

function RecentActivityBar({ recentGame }: { recentGame: { displayName: string; romPath: string; core: string; playedAt: number } }) {
  const navigate = useNavigate();
  const resetLobby = useNetplayLobbyStore((store) => store.resetLobby);

  const href = `/netplay?entry=create-room&romPath=${encodeURIComponent(recentGame.romPath)}&core=${encodeURIComponent(recentGame.core)}`;

  const handlePlayAgain = useCallback(() => {
    resetLobby();
    navigate(href);
  }, [navigate, href, resetLobby]);

  return (
    <section className="rounded-2xl border border-border/70 bg-card/80 px-4 py-3.5">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-xs text-muted-foreground">최근 플레이</div>
          <div className="mt-0.5 flex items-baseline gap-2">
            <span className="truncate text-sm font-medium text-foreground">
              {recentGame.displayName}
            </span>
            <span className="shrink-0 text-xs text-muted-foreground">
              {relativeTimeFormatter.format(recentGame.playedAt)}
            </span>
          </div>
        </div>
        <Button
          type="button"
          size="sm"
          className="h-9 shrink-0 rounded-full px-4 text-xs"
          onClick={handlePlayAgain}
        >
          <Play className="size-3.5" />
          다시하기
        </Button>
      </div>
    </section>
  );
}
