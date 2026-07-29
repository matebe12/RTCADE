import {  Bell, BookOpen, Globe, Home, Moon,  Settings, Sun } from "lucide-react";
import { NavLink, Outlet } from "react-router-dom";

import { SideRailAd } from "@/components/ads/SideRailAd";
import { appEnvironment } from "@/config/environment";
import { useAdVisibility } from "@/hooks/useAdVisibility";
import { UserBadge } from "@/components/UserBadge";
import { Button } from "@rtcade/ui";
import { cn } from "@rtcade/ui";
import type { UserProfile } from "@/lib/user-profile";
import { useTheme } from "@/providers/ThemeProvider";
import { useAppTutorial } from "@/tutorial/app-tutorial-context";

interface AppShellProps {
  profile: UserProfile | null;
  onOpenProfile: () => void;
}

const navigationItems = [
  { to: "/", label: "홈", icon: Home, end: true },
  { to: "/netplay", label: "플레이", icon: Globe },
  { to: "/notices", label: "공지사항", icon: Bell },
  { to: "/settings", label: "설정", icon: Settings },
];

const leftRailSpacerClassName = "hidden w-[180px] shrink-0 xl:block 2xl:w-[200px]";
const rightRailSpacerClassName = "hidden w-[180px] shrink-0 xl:block";

export default function AppShell({ profile, onOpenProfile }: AppShellProps) {
  const { resolvedTheme, setTheme } = useTheme();
  const { startTutorial } = useAppTutorial();
  const isDarkMode = resolvedTheme === "dark";
  const ThemeIcon = isDarkMode ? Sun : Moon;
  const themeToggleLabel = isDarkMode ? "라이트 모드로 전환" : "다크 모드로 전환";
  const { showLeftRail, showRightRail } = useAdVisibility();

  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top,rgba(0,160,255,0.14),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(255,135,61,0.12),transparent_22%)]" />

      <header className="sticky top-0 z-40 border-b border-border/70 bg-background/86 backdrop-blur-xl">
        <div className="mx-auto w-full max-w-[104rem] px-4 py-4 xl:px-6">
          <div className="flex gap-6">
            {showLeftRail && <div aria-hidden className={leftRailSpacerClassName} />}

            <div className="min-w-0 flex-1">
              <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex items-center gap-4">
                  <NavLink to="/" className="flex min-w-0 flex-col">
                    <span className="font-arcade text-sm text-primary">RTCADE</span>
                    <span className="text-[11px] text-muted-foreground">
                      {appEnvironment.siteTagline}
                    </span>
                  </NavLink>
                </div>

                <nav className="flex flex-wrap items-center gap-2">
                  {navigationItems.map((item) => {
                    const Icon = item.icon;
                    return (
                      <NavLink
                        key={item.to}
                        to={item.to}
                        end={item.end}
                        className={({ isActive }) =>
                          cn(
                            "inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm transition-colors",
                            isActive
                              ? "bg-primary text-primary-foreground shadow-[0_10px_30px_rgba(0,132,255,0.18)]"
                              : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                          )
                        }
                      >
                        <Icon className="size-4" />
                        {item.label}
                      </NavLink>
                    );
                  })}
                </nav>

                <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-10 w-10 rounded-full"
                    onClick={startTutorial}
                    aria-label="사용자 여정 튜토리얼 다시 보기"
                    title="사용자 여정 튜토리얼"
                  >
                    <BookOpen className="size-4" />
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-10 w-10 rounded-full"
                    onClick={() => setTheme(isDarkMode ? "light" : "dark")}
                    aria-label={themeToggleLabel}
                    title={themeToggleLabel}
                  >
                    <ThemeIcon className="size-4" />
                  </Button>

                  <Button variant="outline" className="h-10 gap-2 px-3" onClick={onOpenProfile}>
                    {profile ? (
                      <>
                        <UserBadge nickname={profile.nickname} avatar={profile.avatar} size="sm" />
                        <span className="text-xs">프로필 편집</span>
                      </>
                    ) : (
                      <span className="text-xs">프로필 설정</span>
                    )}
                  </Button>
                </div>
              </div>
            </div>

            {showRightRail && <div aria-hidden className={rightRailSpacerClassName} />}
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-[104rem] flex-1 min-h-0 gap-6 px-4 py-8 lg:py-10 xl:px-6">
        <SideRailAd placement="left" visible={showLeftRail} />

        <div className="min-w-0 flex-1 flex flex-col min-h-0">
          <div className="mx-auto flex w-full max-w-6xl flex-1 min-h-0">
            <Outlet />
          </div>
        </div>

        <SideRailAd placement="right" visible={showRightRail} />
      </main>
    </div>
  );
}
