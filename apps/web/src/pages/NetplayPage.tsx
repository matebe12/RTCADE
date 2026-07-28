import { useEffect } from "react";

import { Badge } from "@rtcade/ui";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@rtcade/ui";
import NetplayLobby from "@/components/NetplayLobby";
import { usePageSeo } from "@/lib/seo";
import { NETPLAY_HERO_COPY } from "@/netplay/netplayCopy";
import { useNetplayLobbyStore } from "@/stores/useNetplayLobbyStore";
import { useMobileDetect } from "@/hooks/useMobileDetect";

export default function NetplayPage({ hasProfile }: { hasProfile: boolean }) {
  usePageSeo({
    title: "플레이 로비",
    description:
      "같이하기와 혼자하기를 한곳에서 선택하고 서버 ROM으로 바로 레트로 게임을 시작하세요.",
  });

  const currentStep = useNetplayLobbyStore((store) => store.state.step);
  const mode = useNetplayLobbyStore((store) => store.mode);
  const resetLobby = useNetplayLobbyStore((store) => store.resetLobby);
  const showHeroCard = currentStep === "menu";
  const isMobile = useMobileDetect();

  useEffect(() => {
    return () => {
      resetLobby();
    };
  }, [resetLobby]);

  return (
    <div className="flex w-full flex-col gap-6">
      <div
        className={
          showHeroCard
            ? "grid w-full gap-4 lg:grid-cols-[0.8fr_1.2fr] lg:items-stretch"
            : "flex w-full flex-1 min-h-0"
        }
      >
        {showHeroCard && (
          <Card className="h-full w-full border-border/70 bg-card/95 lg:sticky lg:top-6">
            <CardHeader className="space-y-4">
              <Badge variant="secondary" className="w-fit text-[10px]">
                {mode === "solo" ? "혼자하기" : NETPLAY_HERO_COPY.badge}
              </Badge>
              <div className="space-y-2">
                  <CardTitle className="text-2xl">
                    {mode === "solo"
                      ? "서버에 있는 게임을 골라 바로 혼자 플레이하세요."
                      : NETPLAY_HERO_COPY.title}
                  </CardTitle>
                <CardDescription className="text-sm leading-6">
                    {mode === "solo"
                      ? "공개 방이나 초대 코드 없이도 서버 ROM을 바로 불러와 혼자 즐길 수 있습니다."
                      : NETPLAY_HERO_COPY.description}
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
                {(mode === "solo"
                  ? [
                      "최근 플레이와 즐겨찾기에서 자주 하던 게임을 바로 다시 시작할 수 있습니다.",
                      "플레이 중 세션은 홈의 실시간 이용 현황에도 함께 반영됩니다.",
                    ]
                  : NETPLAY_HERO_COPY.highlights
                ).map((highlight) => (
                <div
                  key={highlight}
                  className="rounded-lg border border-border/70 bg-background/40 p-4"
                >
                  {highlight}
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        <div className="min-w-0 w-full h-full flex flex-col min-h-0">
          {/* 모바일 안내 — 게임 시작 전 메뉴 화면에서만 표시 */}
          {isMobile && showHeroCard && (
            <div className="mb-4 rounded-lg border border-border/70 bg-card/80 px-4 py-3 text-xs text-muted-foreground">
              모바일에서는 화면 하단의 가상 조이스틱으로 플레이할 수 있습니다.
              가로 모드로 전환하면 더 넓은 게임 화면을 볼 수 있습니다.
            </div>
          )}
          <NetplayLobby hasProfile={hasProfile} />
        </div>
      </div>
    </div>
  );
}
