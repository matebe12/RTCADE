import {
  Activity,
  ArrowRight,
  Bell,
  CalendarDays,
  Gamepad2,
  Radio,
  Trophy,
  Users,
} from "lucide-react";
import { useState } from "react";
import { NavLink } from "react-router-dom";

import { SYSTEM_OPTIONS } from "@/components/EmulatorPlayer";
import { useOperationsNotices } from "@/hooks/useOperationsNotices";
import { useOperationsStats } from "@/hooks/useOperationsStats";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { PopularGameSummary } from "@/lib/operations-api";
import { usePageSeo } from "@/lib/seo";
import {
  getRecentGames,
  getRecentOpponents,
  getTotalPlayedCount,
  getUserProfile,
} from "@/lib/user-profile";

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

interface PopularGamesCardProps {
  emptyCopy: string;
  games: PopularGameSummary[];
  periodKey: PopularGamesPeriod;
  title: string;
}

function buildPopularGameEntryHref(entry: "create-room" | "solo", game: PopularGameSummary) {
  const searchParams = new URLSearchParams({ entry });

  if (game.romPath) {
    searchParams.set("romPath", game.romPath);
  }

  if (game.core) {
    searchParams.set("core", game.core);
  }

  return `/netplay?${searchParams.toString()}`;
}

function getPopularGameCoreLabel(core?: string) {
  if (!core) {
    return null;
  }

  return SYSTEM_OPTIONS.find((system) => system.value === core)?.label ?? core;
}

function PopularGamesCard({ emptyCopy, games, periodKey, title }: PopularGamesCardProps) {
  return (
    <div className="rounded-[24px] border border-primary/20 bg-background/80 p-4 shadow-sm shadow-primary/5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="text-xs text-muted-foreground">{title}</div>
          <div className="mt-1 text-sm text-muted-foreground">
            {games.length > 0
              ? `${numberFormatter.format(games.length)}개 인기 게임에서 바로 시작할 수 있어요.`
              : emptyCopy}
          </div>
        </div>
        <Badge variant="secondary" className="w-fit text-[10px]">
          Top 5
        </Badge>
      </div>

      {games.length > 0 ? (
        <div className="mt-4 space-y-3">
          {games.map((game, index) => (
            <div
              key={`${periodKey}-${game.gameName}-${game.romPath ?? index}-${game.core ?? "unknown"}`}
              className="rounded-2xl border border-border/70 bg-background/55 px-3 py-3"
            >
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex size-6 shrink-0 items-center justify-center rounded-full border border-primary/20 bg-primary/10 text-[11px] font-semibold text-primary">
                      {index + 1}
                    </span>
                    {getPopularGameCoreLabel(game.core) ? (
                      <Badge variant="secondary" className="text-[10px]">
                        {getPopularGameCoreLabel(game.core)}
                      </Badge>
                    ) : null}
                    <span className="text-[11px] text-muted-foreground">
                      {numberFormatter.format(game.playCount)}회 플레이
                    </span>
                  </div>
                  <div className="mt-2 truncate text-sm font-medium text-foreground">
                    {game.gameName}
                  </div>
                </div>

                <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                  <Button asChild size="sm" className="h-8 text-[11px] sm:min-w-[88px]">
                    <NavLink to={buildPopularGameEntryHref("create-room", game)}>같이하기</NavLink>
                  </Button>
                  <Button
                    asChild
                    variant="outline"
                    size="sm"
                    className="h-8 text-[11px] sm:min-w-[88px]"
                  >
                    <NavLink to={buildPopularGameEntryHref("solo", game)}>혼자하기</NavLink>
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-4 rounded-2xl border border-dashed border-border/70 bg-background/35 px-4 py-8 text-center text-sm text-muted-foreground">
          {emptyCopy}
        </div>
      )}
    </div>
  );
}

export default function HomePage({ hasProfile }: HomePageProps) {
  usePageSeo({
    title: "홈",
    description:
      "브라우저에서 레트로 게임을 같이하거나 혼자 플레이하고, 방문 통계와 인기 게임, 최근 플레이 기록을 확인하세요.",
  });

  const { error: noticeError, isLoading: noticesLoading, notices } = useOperationsNotices();
  const { error: statsError, isLoading: statsLoading, stats, updatedAt } = useOperationsStats();
  const profile = getUserProfile();
  const recentGames = getRecentGames();
  const recentOpponents = getRecentOpponents();
  const totalPlayedCount = getTotalPlayedCount();
  const previewNotices = notices.slice(0, 3);
  const recentGame = recentGames[0] ?? null;
  const recentOpponent = recentOpponents[0] ?? null;
  const activeRooms = stats?.activeRooms ?? 0;
  const connectedPlayers = stats?.connectedPlayers ?? 0;
  const activeNetplayRooms = stats?.activeNetplayRooms ?? 0;
  const soloSessions = stats?.soloSessions ?? 0;
  const openRooms = stats?.openRooms ?? 0;
  const waitingRooms = stats?.waitingRooms ?? 0;
  const todayPopularGames = stats?.todayPopularGames ?? [];
  const weeklyPopularGames = stats?.weeklyPopularGames ?? [];
  const monthlyPopularGames = stats?.monthlyPopularGames ?? [];
  const [activePopularPeriod, setActivePopularPeriod] = useState<PopularGamesPeriod>("today");

  const popularGamesSections: Array<{
    emptyCopy: string;
    games: PopularGameSummary[];
    key: PopularGamesPeriod;
    label: string;
    title: string;
  }> = [
    {
      key: "today",
      label: "오늘",
      title: "오늘 가장 많이 플레이된 게임",
      games: todayPopularGames,
      emptyCopy: "오늘 기록이 쌓이면 자동으로 보여드려요.",
    },
    {
      key: "weekly",
      label: "이번 주",
      title: "이번 주 가장 많이 플레이된 게임",
      games: weeklyPopularGames,
      emptyCopy: "주간 기록이 쌓이면 자동으로 보여드려요.",
    },
    {
      key: "monthly",
      label: "이번 달",
      title: "이번 달 가장 많이 플레이된 게임",
      games: monthlyPopularGames,
      emptyCopy: "월간 기록이 쌓이면 자동으로 보여드려요.",
    },
  ];
  const activePopularSection =
    popularGamesSections.find((section) => section.key === activePopularPeriod) ??
    popularGamesSections[0];

  const recentPlayDescription = recentGame
    ? recentOpponent
      ? `${recentOpponent.nickname}님과 ${recentGame.displayName}을 플레이했어요.`
      : `${recentGame.displayName}을 최근에 플레이했어요.`
    : hasProfile
      ? "첫 게임을 시작하면 최근 플레이 기록이 여기에 쌓여요."
      : "프로필을 만들고 게임을 시작하면 최근 기록을 바로 볼 수 있어요.";

  return (
    <div className="flex w-full flex-col gap-6 lg:gap-8">
      <section className="grid gap-4 lg:grid-cols-[1.4fr_0.8fr]">
        <Card className="overflow-hidden border-border/70 bg-card/95">
          <CardHeader className="space-y-4">
            <Badge variant="secondary" className="w-fit text-[10px]">
              내 플레이
            </Badge>
            <div className="space-y-3">
              <CardTitle className="max-w-3xl text-3xl leading-tight lg:text-4xl">
                {profile
                  ? `${profile.nickname}님의 최근 플레이 기록이에요.`
                  : "내 플레이 기록을 여기서 확인할 수 있어요."}
              </CardTitle>
              <CardDescription className="max-w-2xl text-sm leading-6 text-muted-foreground">
                {recentPlayDescription}
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3 sm:items-stretch">
              <div className="flex h-full flex-col rounded-lg border border-border/70 bg-background/50 p-4">
                <div className="flex min-h-4 items-center gap-2 text-xs text-muted-foreground">
                  <Gamepad2 className="size-3.5 text-primary" />
                  최근 한 게임
                </div>
                <div className="mt-2 min-h-[2.75rem] text-sm font-medium text-foreground">
                  {recentGame ? recentGame.displayName : "아직 기록이 없어요."}
                </div>
                <div className="mt-auto pt-1 text-xs text-muted-foreground">
                  {recentGame
                    ? `${relativeTimeFormatter.format(recentGame.playedAt)}에 플레이`
                    : "첫 플레이를 시작해보세요."}
                </div>
              </div>

              <div className="flex h-full flex-col rounded-lg border border-border/70 bg-background/50 p-4">
                <div className="min-h-4 text-xs text-muted-foreground">내 브라우저 플레이</div>
                <div className="mt-2 min-h-[2.75rem] text-2xl font-semibold text-foreground">
                  {numberFormatter.format(totalPlayedCount)}판
                </div>
                <div className="mt-auto pt-1 text-xs text-muted-foreground">
                  이 기기에서 플레이할 때마다 개인 기록으로 쌓여요.
                </div>
              </div>

              <div className="flex h-full flex-col rounded-lg border border-border/70 bg-background/50 p-4">
                <div className="min-h-4 text-xs text-muted-foreground">최근 함께한 상대</div>
                <div className="mt-2 min-h-[2.75rem] text-sm font-medium text-foreground">
                  {recentOpponent
                    ? `${recentOpponent.avatar} ${recentOpponent.nickname}`
                    : "아직 없어요."}
                </div>
                <div className="mt-auto pt-1 text-xs text-muted-foreground">
                  {recentOpponent
                    ? `${recentOpponent.playCount}번 함께 플레이했어요.`
                    : "대전을 시작하면 상대 기록도 남아요."}
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-wrap gap-3">
                <Button asChild size="lg" className="font-arcade text-[11px]">
                  <NavLink to="/netplay" data-tutorial="home-play-start">
                    플레이 시작
                    <ArrowRight className="size-4" />
                  </NavLink>
                </Button>
                <Button asChild variant="outline" size="lg">
                  <NavLink to="/notices">공지사항 보기</NavLink>
                </Button>
              </div>

              <div className="rounded-lg border border-border/70 bg-background/60 px-3 py-2 text-xs text-muted-foreground">
                인기 게임 목록에서 바로 같이하거나 혼자 시작할 수 있어요.
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-card/95">
          <CardHeader>
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <Bell className="size-4 text-primary" />
              공지사항
            </div>
            <CardDescription>최근 올라온 공지를 먼저 보여드릴게요.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 text-sm leading-6 text-muted-foreground">
              {stats
                ? `현재 이용 현황은 방문 ${numberFormatter.format(stats.totalVisitors)}명, 실시간 세션 ${numberFormatter.format(activeRooms)}개, 누적 플레이 ${numberFormatter.format(stats.totalGames)}판 기준으로 갱신되고 있어요.`
                : "실시간 운영 지표를 불러오는 중이에요."}
            </div>
            {noticesLoading ? (
              <div className="rounded-lg border border-dashed border-border/70 bg-background/40 p-4 text-sm text-muted-foreground">
                공지 목록을 불러오는 중입니다.
              </div>
            ) : noticeError ? (
              <div className="rounded-lg border border-dashed border-border/70 bg-background/40 p-4 text-sm text-muted-foreground">
                {noticeError}
              </div>
            ) : previewNotices.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border/70 bg-background/40 p-4 text-sm text-muted-foreground">
                아직 공지가 없어요. 새 소식이 올라오면 여기에서 바로 볼 수 있어요.
              </div>
            ) : (
              previewNotices.map((notice) => (
                <div
                  key={notice.id}
                  className="rounded-lg border border-border/70 bg-background/50 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-2">
                      <div className="text-sm font-medium text-foreground">{notice.title}</div>
                      <div className="line-clamp-2 text-sm leading-6 text-muted-foreground">
                        {notice.body}
                      </div>
                    </div>
                    {notice.isPinned && (
                      <Badge variant="secondary" className="text-[10px]">
                        고정
                      </Badge>
                    )}
                  </div>
                </div>
              ))
            )}
            <Button asChild variant="ghost" className="w-fit px-0 text-sm">
              <NavLink to="/notices">
                공지사항 전체 보기
                <ArrowRight className="size-4" />
              </NavLink>
            </Button>
          </CardContent>
        </Card>
      </section>

      <section className="overflow-hidden rounded-[28px] border border-border/70 bg-card/95">
        <div className="flex flex-col gap-3 border-b border-border/70 px-5 py-5 lg:flex-row lg:items-end lg:justify-between lg:px-6">
          <div className="space-y-2">
            <Badge variant="secondary" className="w-fit text-[10px]">
              실시간 운영
            </Badge>
            <div className="space-y-1">
              <h2 className="text-2xl font-semibold tracking-tight text-foreground lg:text-3xl">
                실시간 이용 현황
              </h2>
              <p className="text-sm leading-6 text-muted-foreground">
                방문, 플레이, 인기 게임 흐름을 한 번에 확인할 수 있어요.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start rounded-full border border-primary/20 bg-primary/5 px-3 py-1.5 text-xs text-muted-foreground lg:self-auto">
            <span className="size-2 rounded-full bg-primary" />
            {statsLoading
              ? "데이터 동기화 중"
              : statsError
                ? statsError
                : `마지막 반영 ${updatedAt ? relativeTimeFormatter.format(updatedAt) : "방금 전"}`}
          </div>
        </div>

        <div className="grid gap-4 p-4 lg:grid-cols-[1.45fr_0.95fr]">
          <div className="flex h-full flex-col gap-4 rounded-[24px] bg-gradient-to-br from-primary/10 via-background/70 to-background/40 p-4 lg:p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-xs font-medium uppercase tracking-[0.2em] text-primary">
                  Live Overview
                </div>
                <div className="mt-1 text-lg font-semibold text-foreground">실시간 이용 현황</div>
              </div>
              <Activity className="size-5 text-primary" />
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-[22px] border border-primary/15 bg-background/80 px-5 py-5 shadow-sm shadow-primary/5 lg:px-6">
                <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                  <Users className="size-3.5 text-primary" />총 방문자
                </div>
                <div className="mt-3 text-4xl font-semibold tracking-tight text-foreground lg:text-5xl">
                  {stats ? `${numberFormatter.format(stats.totalVisitors)}명` : "--"}
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  {stats
                    ? `오늘 신규 방문은 ${numberFormatter.format(stats.todayVisitors)}명이에요.`
                    : "방문 지표를 불러오는 중이에요."}
                </p>
              </div>

              <div className="rounded-[22px] border border-primary/15 bg-background/80 px-5 py-5 shadow-sm shadow-primary/5 lg:px-6">
                <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                  <Activity className="size-3.5 text-primary" />
                  지금 게임 중
                </div>
                <div className="mt-3 text-4xl font-semibold tracking-tight text-foreground lg:text-5xl">
                  {stats ? `${numberFormatter.format(activeRooms)}개` : "--"}
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  {stats
                    ? `${connectedPlayers}명이 ${activeRooms}개 세션에서 플레이 중이에요.`
                    : "실시간 세션을 불러오는 중이에요."}
                </p>
              </div>

              <div className="rounded-[22px] border border-primary/15 bg-background/80 px-5 py-5 shadow-sm shadow-primary/5 lg:px-6">
                <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                  <Gamepad2 className="size-3.5 text-primary" />총 플레이 게임
                </div>
                <div className="mt-3 text-4xl font-semibold tracking-tight text-foreground lg:text-5xl">
                  {stats ? `${numberFormatter.format(stats.totalGames)}판` : "--"}
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  {stats
                    ? `오늘 시작된 게임은 ${numberFormatter.format(stats.todayGames)}판이에요.`
                    : "플레이 기록을 불러오는 중이에요."}
                </p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-4 rounded-[22px] border border-primary/15 bg-background/75 px-5 py-5 shadow-sm shadow-primary/5 lg:px-6">
                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <Radio className="size-4 text-primary" />
                  실시간 모드 분포
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-border/70 bg-card/80 p-4">
                    <div className="text-xs text-muted-foreground">넷플레이 세션</div>
                    <div className="mt-2 text-3xl font-semibold text-foreground">
                      {stats ? `${numberFormatter.format(activeNetplayRooms)}개` : "--"}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      열린 방 {numberFormatter.format(openRooms)}개 · 대기{" "}
                      {numberFormatter.format(waitingRooms)}개
                    </div>
                  </div>
                  <div className="rounded-2xl border border-border/70 bg-card/80 p-4">
                    <div className="text-xs text-muted-foreground">혼자하기 세션</div>
                    <div className="mt-2 text-3xl font-semibold text-foreground">
                      {stats ? `${numberFormatter.format(soloSessions)}개` : "--"}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      상대 연결 없이 바로 실행된 플레이예요.
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-4 rounded-[22px] border border-primary/15 bg-background/75 px-5 py-5 shadow-sm shadow-primary/5 lg:px-6">
                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <CalendarDays className="size-4 text-primary" />
                  오늘 흐름
                </div>
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3 border-b border-border/70 pb-3">
                    <div>
                      <div className="text-sm font-medium text-foreground">오늘 방문자</div>
                      <div className="text-xs text-muted-foreground">오늘 들어온 사용자 수</div>
                    </div>
                    <div className="text-right text-2xl font-semibold text-foreground">
                      {stats ? `${numberFormatter.format(stats.todayVisitors)}명` : "--"}
                    </div>
                  </div>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium text-foreground">오늘 시작된 게임</div>
                      <div className="text-xs text-muted-foreground">기록된 전체 시작 수</div>
                    </div>
                    <div className="text-right text-2xl font-semibold text-foreground">
                      {stats ? `${numberFormatter.format(stats.todayGames)}판` : "--"}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex h-full flex-col rounded-[24px] bg-gradient-to-br from-primary/10 via-background/70 to-background/40 px-5 py-5 lg:px-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-xs font-medium uppercase tracking-[0.2em] text-primary">
                  Popular Now
                </div>
                <div className="mt-1 text-lg font-semibold text-foreground">
                  인기 게임 스포트라이트
                </div>
              </div>
              <Trophy className="size-5 text-primary" />
            </div>

            <div className="mt-4 flex flex-1 flex-col gap-4">
              <div className="flex flex-wrap gap-2">
                {popularGamesSections.map((section) => (
                  <Button
                    key={section.key}
                    type="button"
                    size="sm"
                    variant={section.key === activePopularPeriod ? "default" : "outline"}
                    className="h-8 rounded-full px-3 text-[11px]"
                    onClick={() => setActivePopularPeriod(section.key)}
                  >
                    {section.label}
                  </Button>
                ))}
              </div>

              <PopularGamesCard
                periodKey={activePopularSection.key}
                title={activePopularSection.title}
                games={activePopularSection.games}
                emptyCopy={activePopularSection.emptyCopy}
              />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
