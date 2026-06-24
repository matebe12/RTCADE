import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import NetplayLobby from "@/components/NetplayLobby";
import { usePageSeo } from "@/lib/seo";
import { NETPLAY_HERO_COPY } from "@/netplay/netplayCopy";
import { useNetplayLobbyStore } from "@/stores/useNetplayLobbyStore";

function detectMobileAccess() {
  if (typeof window === "undefined") return false;

  const touchDevice = window.matchMedia("(pointer: coarse)").matches;
  const narrowViewport = window.matchMedia("(max-width: 1023px)").matches;
  const mobileUserAgent = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent,
  );

  return narrowViewport && (touchDevice || mobileUserAgent);
}

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
  const [isMobileAccess, setIsMobileAccess] = useState(detectMobileAccess);

  useEffect(() => {
    const updateMobileAccess = () => {
      setIsMobileAccess(detectMobileAccess());
    };

    const pointerQuery = window.matchMedia("(pointer: coarse)");
    const widthQuery = window.matchMedia("(max-width: 1023px)");

    updateMobileAccess();
    pointerQuery.addEventListener("change", updateMobileAccess);
    widthQuery.addEventListener("change", updateMobileAccess);

    return () => {
      pointerQuery.removeEventListener("change", updateMobileAccess);
      widthQuery.removeEventListener("change", updateMobileAccess);
    };
  }, []);

  useEffect(() => {
    return () => {
      resetLobby();
    };
  }, [resetLobby]);

  if (isMobileAccess) {
    return (
      <div className="flex w-full justify-center">
        <Card className="w-full max-w-2xl border-border/70 bg-card/95">
          <CardHeader className="space-y-4">
            <Badge variant="secondary" className="w-fit text-[10px]">
              PC 전용
            </Badge>
            <div className="space-y-2">
              <CardTitle className="text-2xl">넷플레이는 PC에서 접속해 주세요</CardTitle>
              <CardDescription className="text-sm leading-6">
                현재 같이하기와 혼자하기 모두 키보드와 게임패드 중심으로 설계되어 있어 모바일에서는
                안정적인 플레이가 어렵습니다.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <div className="rounded-lg border border-border/70 bg-background/40 p-4">
              데스크톱 또는 노트북 브라우저에서 다시 접속해 주세요.
            </div>
            <div className="rounded-lg border border-border/70 bg-background/40 p-4">
              가능하면 키보드 또는 게임패드를 연결한 환경을 권장합니다.
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col gap-6">
      <div
        className={
          showHeroCard
            ? "grid w-full gap-4 lg:grid-cols-[0.8fr_1.2fr] lg:items-stretch"
            : "flex w-full"
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

        <div className="min-w-0 w-full lg:h-full">
          <NetplayLobby hasProfile={hasProfile} />
        </div>
      </div>
    </div>
  );
}
