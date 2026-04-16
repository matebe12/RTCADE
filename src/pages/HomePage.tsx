import { Activity, ArrowRight, Bell, Globe, Users } from "lucide-react";
import { NavLink } from "react-router-dom";

import { appEnvironment } from "@/config/environment";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface HomePageProps {
  hasProfile: boolean;
}

const statCards = [
  {
    title: "총 방문자",
    description: "Railway PostgreSQL 기반 누적 방문자 집계를 붙일 자리입니다.",
    icon: Users,
  },
  {
    title: "오늘 방문자",
    description: "일별 dedupe 정책을 적용한 오늘 방문자 수 카드가 들어옵니다.",
    icon: Bell,
  },
  {
    title: "현재 게임중",
    description: "활성 room 기반 동시 플레이 수를 준실시간으로 노출합니다.",
    icon: Activity,
  },
];

export default function HomePage({ hasProfile }: HomePageProps) {
  return (
    <div className="flex w-full flex-col gap-6 lg:gap-8">
      <section className="grid gap-4 lg:grid-cols-[1.4fr_0.8fr]">
        <Card className="overflow-hidden border-border/70 bg-card/95">
          <CardHeader className="space-y-4">
            <Badge variant="secondary" className="w-fit text-[10px]">
              리팩터링 기반 구축 시작
            </Badge>
            <div className="space-y-3">
              <CardTitle className="max-w-3xl text-3xl leading-tight lg:text-4xl">
                넷플레이 허브를 사이트형 제품으로 확장할 준비를 시작했습니다.
              </CardTitle>
              <CardDescription className="max-w-2xl text-sm leading-6 text-muted-foreground">
                홈, 넷플레이, 공지사항, 설정을 분리된 앱 셸 위에 올리고, 이후 운영 지표와 공지
                시스템을 같은 레이아웃 체계로 확장합니다.
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

            <div className="grid gap-2 text-xs text-muted-foreground">
              <div className="rounded-lg border border-border/70 bg-background/60 px-3 py-2">
                API {appEnvironment.apiHostLabel}
              </div>
              <div className="rounded-lg border border-border/70 bg-background/60 px-3 py-2">
                WS {appEnvironment.wsHostLabel}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-card/95">
          <CardHeader>
            <CardTitle className="text-lg">현재 준비 상태</CardTitle>
            <CardDescription>리팩터 전환 중에도 기존 넷플레이 흐름은 유지합니다.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <div className="rounded-lg border border-border/70 bg-background/50 p-4">
              채팅, 세션 요약, 공개 방, 최근 기록 기능은 이미 baseline 커밋으로 고정되었습니다.
            </div>
            <div className="rounded-lg border border-border/70 bg-background/50 p-4">
              {hasProfile
                ? "현재 프로필이 설정되어 있어 바로 넷플레이를 시작할 수 있습니다."
                : "프로필이 아직 없으면 시작 시 닉네임과 아바타를 먼저 설정하게 됩니다."}
            </div>
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
                  <Badge variant="outline" className="text-[10px]">
                    준비 중
                  </Badge>
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
              상단 고정 공지, 일반 공지 목록, 운영 배너 슬롯이 이 영역에서 시작됩니다.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-lg border border-dashed border-border/70 bg-background/40 p-4 text-sm text-muted-foreground">
              운영 점검, 신규 기능 안내, 이벤트 소식은 추후 이 레일을 통해 노출됩니다.
            </div>
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
              <Globe className="size-4 text-primary" />
              넷플레이 이동
            </div>
            <CardDescription>
              현재 플레이 경험은 그대로 유지한 채 상위 셸 구조만 교체합니다.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-lg border border-border/70 bg-background/50 p-4 text-sm text-muted-foreground">
              리팩터 이후에는 이 영역에 최근 매치, 현재 게임중, 빠른 참가 카드가 함께 들어가게
              됩니다.
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
