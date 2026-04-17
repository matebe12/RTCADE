import { Activity, ArrowRight, Bell, Gamepad2, Radio, Trophy } from "lucide-react";
import { NavLink } from "react-router-dom";

import { useOperationsNotices } from "@/hooks/useOperationsNotices";
import { useOperationsStats } from "@/hooks/useOperationsStats";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  getRecentGames,
  getRecentOpponents,
  getTotalPlayedCount,
  getUserProfile,
} from "@/lib/user-profile";

interface HomePageProps {
  hasProfile: boolean;
}

const numberFormatter = new Intl.NumberFormat("ko-KR");

const relativeTimeFormatter = new Intl.DateTimeFormat("ko-KR", {
  hour: "2-digit",
  minute: "2-digit",
  month: "short",
  day: "numeric",
});

export default function HomePage({ hasProfile }: HomePageProps) {
  const { error: noticeError, isLoading: noticesLoading, notices } = useOperationsNotices();
  const { error: statsError, isLoading: statsLoading, stats, updatedAt } = useOperationsStats();
  const profile = getUserProfile();
  const recentGames = getRecentGames();
  const recentOpponents = getRecentOpponents();
  const totalPlayedCount = getTotalPlayedCount();
  const previewNotices = notices.slice(0, 3);
  const recentGame = recentGames[0] ?? null;
  const recentOpponent = recentOpponents[0] ?? null;

  const recentPlayDescription = recentGame
    ? recentOpponent
      ? `${recentOpponent.nickname}님과 ${recentGame.displayName}을 플레이했어요.`
      : `${recentGame.displayName}을 최근에 플레이했어요.`
    : hasProfile
      ? "첫 게임을 시작하면 최근 플레이 기록이 여기에 쌓여요."
      : "프로필을 만들고 게임을 시작하면 최근 기록을 바로 볼 수 있어요.";

  const statCards = [
    {
      title: "지금 게임 중",
      description: stats
        ? `지금 ${stats.connectedPlayers}명이 ${stats.activeRooms}개 방에서 플레이 중이에요.`
        : "지금 플레이 중인 게임 수를 불러오는 중이에요.",
      icon: Activity,
      value: stats ? `${numberFormatter.format(stats.activeRooms)}개` : "--",
    },
    {
      title: "오늘 총 게임",
      description: stats
        ? `오늘 시작된 게임은 모두 ${numberFormatter.format(stats.todayGames)}판이에요.`
        : "오늘 기록된 게임 수를 불러오는 중이에요.",
      icon: Gamepad2,
      value: stats ? `${numberFormatter.format(stats.todayGames)}판` : "--",
    },
    {
      title: "주간 인기 게임",
      description: stats?.weeklyPopularGame
        ? `이번 주에 ${numberFormatter.format(stats.weeklyPopularGame.playCount)}번 플레이됐어요.`
        : "이번 주 기록이 쌓이면 가장 많이 한 게임을 보여드릴게요.",
      icon: Trophy,
      value: stats?.weeklyPopularGame?.gameName ?? "아직 없어요.",
      valueClassName: "line-clamp-2 text-xl leading-snug lg:text-2xl",
    },
    {
      title: "월간 인기 게임",
      description: stats?.monthlyPopularGame
        ? `이번 달에 ${numberFormatter.format(stats.monthlyPopularGame.playCount)}번 플레이됐어요.`
        : "이번 달 기록이 쌓이면 가장 많이 한 게임을 보여드릴게요.",
      icon: Trophy,
      value: stats?.monthlyPopularGame?.gameName ?? "아직 없어요.",
      valueClassName: "line-clamp-2 text-xl leading-snug lg:text-2xl",
    },
  ];

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
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border border-border/70 bg-background/50 p-4">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Gamepad2 className="size-3.5 text-primary" />
                  최근 한 게임
                </div>
                <div className="mt-2 text-sm font-medium text-foreground">
                  {recentGame ? recentGame.displayName : "아직 기록이 없어요."}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {recentGame
                    ? `${relativeTimeFormatter.format(recentGame.playedAt)}에 플레이`
                    : "첫 플레이를 시작해보세요."}
                </div>
              </div>

              <div className="rounded-lg border border-border/70 bg-background/50 p-4">
                <div className="text-xs text-muted-foreground">지금까지 한 판</div>
                <div className="mt-2 text-2xl font-semibold text-foreground">
                  {numberFormatter.format(totalPlayedCount)}판
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  플레이할 때마다 자동으로 기록돼요.
                </div>
              </div>

              <div className="rounded-lg border border-border/70 bg-background/50 p-4">
                <div className="text-xs text-muted-foreground">최근 함께한 상대</div>
                <div className="mt-2 text-sm font-medium text-foreground">
                  {recentOpponent
                    ? `${recentOpponent.avatar} ${recentOpponent.nickname}`
                    : "아직 없어요."}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {recentOpponent
                    ? `${recentOpponent.playCount}번 함께 플레이했어요.`
                    : "대전을 시작하면 상대 기록도 남아요."}
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-wrap gap-3">
                <Button asChild size="lg" className="font-arcade text-[11px]">
                  <NavLink to="/netplay">
                    넷플레이 시작
                    <ArrowRight className="size-4" />
                  </NavLink>
                </Button>
                <Button asChild variant="outline" size="lg">
                  <NavLink to="/notices">공지사항 보기</NavLink>
                </Button>
              </div>

              <div className="rounded-lg border border-border/70 bg-background/60 px-3 py-2 text-xs text-muted-foreground">
                기록은 최근 플레이 순서대로 자동으로 정리돼요.
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-card/95">
          <CardHeader>
            <CardTitle className="text-lg">시작하기 전에</CardTitle>
            <CardDescription>프로필 설정과 현재 방 상황을 먼저 확인해보세요.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <div className="rounded-lg border border-border/70 bg-background/50 p-4">
              {statsLoading
                ? "이용 현황을 불러오는 중이에요."
                : statsError
                  ? statsError
                  : `마지막으로 반영된 시각은 ${updatedAt ? relativeTimeFormatter.format(updatedAt) : "방금 전"}이에요.`}
            </div>
            <div className="rounded-lg border border-border/70 bg-background/50 p-4">
              {hasProfile
                ? "프로필 설정이 끝나 있어 바로 넷플레이를 시작할 수 있어요."
                : "아직 프로필이 없으면 시작 전에 닉네임과 아바타를 먼저 정하게 돼요."}
            </div>
            {stats && (
              <div className="rounded-lg border border-border/70 bg-background/50 p-4">
                지금 열린 방은 {stats.openRooms}개이고, 그중 {stats.activeRooms}개는 플레이 중,{" "}
                {stats.waitingRooms}개는 대기 중이에요.
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-4">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <Card key={card.title} className="border-border/70 bg-card/95">
              <CardHeader className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                    <Icon className="size-4 text-primary" />
                    {card.title}
                  </div>
                  <Badge variant="secondary" className="text-[10px]">
                    {statsLoading ? "로딩 중" : "업데이트"}
                  </Badge>
                </div>
                <div
                  className={`font-semibold tracking-tight text-foreground ${card.valueClassName ?? "text-3xl"}`}
                >
                  {card.value}
                </div>
                <CardDescription>{card.description}</CardDescription>
              </CardHeader>
            </Card>
          );
        })}
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <Card className="border-border/70 bg-card/95">
          <CardHeader>
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <Bell className="size-4 text-primary" />
              공지사항
            </div>
            <CardDescription>최근 올라온 공지를 먼저 보여드릴게요.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
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
                      <div className="text-sm leading-6 text-muted-foreground line-clamp-2">
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

        <Card className="border-border/70 bg-card/95">
          <CardHeader>
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <Radio className="size-4 text-primary" />
              넷플레이 현황
            </div>
            <CardDescription>
              지금 몇 명이 접속해 있고 몇 개의 방이 진행 중인지 보여드려요.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-lg border border-border/70 bg-background/50 p-4 text-sm text-muted-foreground">
              {stats
                ? `지금 ${stats.connectedPlayers}명이 접속 중이고 ${stats.activeRooms}개 방에서 플레이하고 있어요.`
                : "지금 접속 현황을 불러오는 중이에요."}
            </div>
            <Button asChild className="w-full">
              <NavLink to="/netplay">넷플레이 로비로 이동</NavLink>
            </Button>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
