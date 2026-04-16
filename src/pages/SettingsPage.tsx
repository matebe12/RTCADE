import { Monitor, Moon, Sun } from "lucide-react";

import { UserBadge } from "@/components/UserBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { UserProfile } from "@/lib/user-profile";
import { useTheme, type ThemePreference } from "@/providers/ThemeProvider";

interface SettingsPageProps {
  profile: UserProfile | null;
  onOpenProfile: () => void;
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
    description: "밝은 배경과 높은 가독성으로 페이지형 화면을 준비합니다.",
    icon: Sun,
  },
  {
    value: "dark",
    label: "다크",
    description: "현재 넷플레이와 에뮬레이터 중심 화면에 익숙한 톤입니다.",
    icon: Moon,
  },
  {
    value: "system",
    label: "시스템",
    description: "운영체제 설정을 따라 자동으로 전환됩니다.",
    icon: Monitor,
  },
];

export default function SettingsPage({ profile, onOpenProfile }: SettingsPageProps) {
  const { theme, resolvedTheme, setTheme } = useTheme();

  return (
    <div className="grid w-full gap-4 lg:grid-cols-[0.8fr_1.2fr]">
      <Card className="border-border/70 bg-card/95">
        <CardHeader>
          <CardTitle className="text-xl">프로필</CardTitle>
          <CardDescription>닉네임과 아바타는 넷플레이, 채팅, 최근 상대 카드에 그대로 반영됩니다.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border border-border/70 bg-background/50 p-4">
            {profile ? (
              <div className="space-y-3">
                <UserBadge nickname={profile.nickname} avatar={profile.avatar} size="sm" />
                <p className="text-sm text-muted-foreground">현재 프로필이 모든 세션 경험의 기본 식별자로 쓰입니다.</p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">아직 프로필이 없습니다. 먼저 닉네임과 아바타를 설정하세요.</p>
            )}
          </div>
          <Button onClick={onOpenProfile} className="w-full">
            {profile ? "프로필 다시 설정" : "프로필 설정"}
          </Button>
        </CardContent>
      </Card>

      <Card className="border-border/70 bg-card/95">
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle className="text-xl">테마</CardTitle>
              <CardDescription>라이트, 다크, 시스템 테마를 앱 전체에서 공통 토큰으로 관리합니다.</CardDescription>
            </div>
            <Badge variant="secondary" className="text-[10px]">
              현재 {theme === "system" ? `시스템 · ${resolvedTheme === "dark" ? "다크" : "라이트"}` : theme}
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
    </div>
  );
}