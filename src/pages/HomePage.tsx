import { Activity, ArrowRight, Bell, Radio, Users } from "lucide-react";
import { NavLink } from "react-router-dom";

import { useOperationsNotices } from "@/hooks/useOperationsNotices";
import { useOperationsStats } from "@/hooks/useOperationsStats";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

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
  const previewNotices = notices.slice(0, 3);

  const statCards = [
    {
      title: "총 방문자",
      description: "지금까지 이 공간을 찾아온 이용자 수입니다.",
      icon: Users,
      value: stats ? numberFormatter.format(stats.totalVisitors) : "--",
    },
    {
      title: "오늘 방문자",
      description: "오늘 이곳을 찾은 이용자 수를 기준으로 집계합니다.",
      icon: Bell,
      value: stats ? numberFormatter.format(stats.todayVisitors) : "--",
    },
    {
      title: "현재 게임중",
      description: stats
        ? `열린 방 ${stats.openRooms}개, 대기 ${stats.waitingRooms}개를 합친 현재 접속 플레이어 수입니다.`
        : "활성 room 기반 동시 플레이 수를 준실시간으로 불러옵니다.",
      icon: Activity,
      value: stats ? numberFormatter.format(stats.connectedPlayers) : "--",
    },
  ];

  return (
    <div className="flex w-full flex-col gap-6 lg:gap-8">
      <section className="grid gap-4 lg:grid-cols-[1.4fr_0.8fr]">
        <Card className="overflow-hidden border-border/70 bg-card/95">
          <CardHeader className="space-y-4">
            <Badge variant="secondary" className="w-fit text-[10px]">
              서비스 현황
            </Badge>
            <div className="space-y-3">
              <CardTitle className="max-w-3xl text-3xl leading-tight lg:text-4xl">
                넷플레이 허브의 소식과 이용 현황을 한눈에 확인할 수 있습니다.
              </CardTitle>
              <CardDescription className="max-w-2xl text-sm leading-6 text-muted-foreground">
                홈에서는 방문 현황과 현재 게임중 수를 요약하고, 공지사항 페이지에서는 최신 소식을
                읽기 전용으로 확인할 수 있습니다.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
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
              공지와 이용 현황은 자동으로 갱신됩니다.
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-card/95">
          <CardHeader>
            <CardTitle className="text-lg">현재 준비 상태</CardTitle>
            <CardDescription>
              기존 넷플레이 흐름은 유지한 채 운영 계층만 별도로 확장합니다.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <div className="rounded-lg border border-border/70 bg-background/50 p-4">
              {statsLoading
                ? "이용 현황을 확인하는 중입니다."
                : statsError
                  ? statsError
                  : `최근 현황이 반영되어 있으며 마지막 갱신은 ${updatedAt ? relativeTimeFormatter.format(updatedAt) : "방금"} 입니다.`}
            </div>
            <div className="rounded-lg border border-border/70 bg-background/50 p-4">
              {hasProfile
                ? "현재 프로필이 설정되어 있어 바로 넷플레이를 시작할 수 있습니다."
                : "프로필이 아직 없으면 시작 시 닉네임과 아바타를 먼저 설정하게 됩니다."}
            </div>
            {stats && (
              <div className="rounded-lg border border-border/70 bg-background/50 p-4">
                현재 열린 방 {stats.openRooms}개 중 진행 중인 방은 {stats.activeRooms}개, 대기 중인
                방은 {stats.waitingRooms}개입니다.
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
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
                <div className="text-3xl font-semibold tracking-tight text-foreground">
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
              공지사항 허브
            </div>
            <CardDescription>
              홈에서 최근 공지를 미리 보고, 전체 목록은 공지사항 페이지에서 확인할 수 있습니다.
            </CardDescription>
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
                아직 게시된 공지가 없습니다. 이후 점검, 업데이트, 이벤트 소식이 여기에 표시됩니다.
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
                공지사항 구조 미리 보기
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
            <CardDescription>현재 넷플레이 로비와 방 흐름은 그대로 유지됩니다.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-lg border border-border/70 bg-background/50 p-4 text-sm text-muted-foreground">
              {stats
                ? `현재 ${stats.connectedPlayers}명이 접속 중이며 ${stats.activeRooms}개 방에서 플레이 중입니다.`
                : "리팩터 이후에는 이 영역에 최근 매치, 현재 게임중, 빠른 참가 카드가 함께 들어가게 됩니다."}
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
