import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import NetplayLobby from "@/components/NetplayLobby";
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

export default function NetplayPage() {
  const currentStep = useNetplayLobbyStore((store) => store.state.step);
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
                현재 넷플레이는 키보드와 게임패드 중심으로 설계되어 있어 모바일에서는 대전 플레이가
                어렵습니다.
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
            ? "grid w-full gap-4 lg:grid-cols-[0.8fr_1.2fr] lg:items-start"
            : "flex justify-center"
        }
      >
        {showHeroCard && (
          <Card className="w-full border-border/70 bg-card/95 lg:sticky lg:top-6">
            <CardHeader className="space-y-4">
              <Badge variant="secondary" className="w-fit text-[10px]">
                {NETPLAY_HERO_COPY.badge}
              </Badge>
              <div className="space-y-2">
                <CardTitle className="text-2xl">{NETPLAY_HERO_COPY.title}</CardTitle>
                <CardDescription className="text-sm leading-6">
                  {NETPLAY_HERO_COPY.description}
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              {NETPLAY_HERO_COPY.highlights.map((highlight) => (
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

        <div className="min-w-0">
          <NetplayLobby />
        </div>
      </div>
    </div>
  );
}
