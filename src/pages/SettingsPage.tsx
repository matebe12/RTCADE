import { Monitor, Moon, ShieldAlert, Sun } from "lucide-react";

import { UserBadge } from "@/components/UserBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { usePageSeo } from "@/lib/seo";
import type { UserProfile } from "@/lib/user-profile";
import { useAppTutorial } from "@/tutorial/app-tutorial-context";
import { useTheme, type ThemePreference } from "@/providers/ThemeProvider";

interface SettingsPageProps {
  profile: UserProfile | null;
  onOpenProfile: () => void;
}

function getThemeLabel(theme: ThemePreference) {
  switch (theme) {
    case "light":
      return "라이트";
    case "dark":
      return "다크";
    default:
      return "시스템";
  }
}

const themeOptions: Array<{
  value: ThemePreference;
  label: string;
  description: string;
  icon: typeof Sun;
}> = [
  {
    value: "light",
    label: "라이트",
    description: "밝고 또렷한 화면으로 메뉴와 안내를 보기 좋게 보여줍니다.",
    icon: Sun,
  },
  {
    value: "dark",
    label: "다크",
    description: "게임 화면과 잘 어울리는 차분한 분위기입니다.",
    icon: Moon,
  },
  {
    value: "system",
    label: "시스템",
    description: "기기 설정에 맞춰 자동으로 바뀝니다.",
    icon: Monitor,
  },
];

export default function SettingsPage({ profile, onOpenProfile }: SettingsPageProps) {
  usePageSeo({
    title: "설정",
    description: "RTCADE 프로필과 테마를 설정하고 플레이 환경을 원하는 방식으로 맞추세요.",
    noIndex: true,
  });

  const { theme, resolvedTheme, setTheme } = useTheme();
  const { startTutorial } = useAppTutorial();

  return (
    <div className="grid w-full gap-4 lg:grid-cols-[0.8fr_1.2fr]">
      <Card className="border-border/70 bg-card/95">
        <CardHeader>
          <CardTitle className="text-xl">프로필</CardTitle>
          <CardDescription>
            닉네임과 아바타는 방, 채팅, 최근 함께한 기록에 표시됩니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border border-border/70 bg-background/50 p-4">
            {profile ? (
              <div className="space-y-3">
                <UserBadge nickname={profile.nickname} avatar={profile.avatar} size="sm" />
                <p className="text-sm text-muted-foreground">
                  현재 프로필은 방과 채팅에서 함께 표시됩니다.
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                아직 프로필이 없습니다. 먼저 닉네임과 아바타를 설정하세요.
              </p>
            )}
          </div>
          <Button onClick={onOpenProfile} className="w-full">
            {profile ? "프로필 다시 설정" : "프로필 설정"}
          </Button>
          <div className="rounded-lg border border-border/70 bg-background/40 p-4">
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">사용자 여정 튜토리얼</p>
              <p className="text-sm text-muted-foreground">
                홈에서 플레이 시작 후 방 만들기, 대기실, 혼자 시작, 실제 플레이 화면까지 다시 따라볼 수 있습니다.
              </p>
            </div>
            <Button type="button" variant="outline" className="mt-3 w-full" onClick={startTutorial}>
              튜토리얼 다시 보기
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/70 bg-card/95">
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle className="text-xl">테마</CardTitle>
              <CardDescription>원하는 분위기로 화면을 맞춰보세요.</CardDescription>
            </div>
            <Badge variant="secondary" className="text-[10px]">
              현재{" "}
              {theme === "system"
                ? `시스템 · ${resolvedTheme === "dark" ? "다크" : "라이트"}`
                : getThemeLabel(theme)}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="grid gap-3">
          {themeOptions.map((option) => {
            const Icon = option.icon;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => setTheme(option.value)}
                className={`rounded-xl border px-4 py-4 text-left transition-colors ${
                  theme === option.value
                    ? "border-primary bg-primary/10"
                    : "border-border/70 bg-background/40 hover:bg-accent"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="rounded-full bg-background p-2">
                    <Icon className="size-4 text-primary" />
                  </div>
                  <div className="space-y-1">
                    <div className="text-sm font-medium text-foreground">{option.label}</div>
                    <div className="text-sm text-muted-foreground">{option.description}</div>
                  </div>
                </div>
              </button>
            );
          })}
        </CardContent>
      </Card>

      <Card className="border-border/70 bg-card/95 lg:col-span-2">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-background p-2">
              <ShieldAlert className="size-4 text-primary" />
            </div>
            <div>
              <CardTitle className="text-xl">프로젝트 성격</CardTitle>
              <CardDescription>
                이 프로젝트는 수익 창출을 목적으로 하지 않으며, WebRTC 넷플레이와 에뮬레이터 연동 구조를 보여주기 위한 포트폴리오용 기술 데모입니다.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm text-muted-foreground lg:grid-cols-3">
          <div className="rounded-xl border border-border/70 bg-background/40 p-4">
            <p className="font-medium text-foreground">포트폴리오 목적</p>
            <p className="mt-2">
              핵심 목적은 게임 서비스 운영이 아니라 WebRTC, 상태 동기화, iframe 기반 EmulatorJS 브리지 같은 구현 역량을 보여주는 것입니다.
            </p>
          </div>
          <div className="rounded-xl border border-border/70 bg-background/40 p-4">
            <p className="font-medium text-foreground">수익 목적 없음</p>
            <p className="mt-2">
              광고나 과금처럼 수익화 요소 없이, 포트폴리오와 기술 검증 중심의 데모 형태로 유지하는 방향을 전제로 합니다.
            </p>
          </div>
          <div className="rounded-xl border border-border/70 bg-background/40 p-4">
            <p className="font-medium text-foreground">콘텐츠 주의사항</p>
            <p className="mt-2">
              깃 저장소에는 상용 ROM과 BIOS를 직접 커밋하지 않는 전제입니다.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
