import { ArrowRight, Bell, Globe, Home, Pin, Settings } from "lucide-react";
import { NavLink, Outlet } from "react-router-dom";

import { appEnvironment } from "@/config/environment";
import { useOperationsNotices } from "@/hooks/useOperationsNotices";
import { UserBadge } from "@/components/UserBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { UserProfile } from "@/lib/user-profile";
import { useTheme } from "@/providers/ThemeProvider";

interface AppShellProps {
  profile: UserProfile | null;
  onOpenProfile: () => void;
}

const navigationItems = [
  { to: "/", label: "홈", icon: Home, end: true },
  { to: "/netplay", label: "넷플레이", icon: Globe },
  { to: "/notices", label: "공지사항", icon: Bell },
  { to: "/settings", label: "설정", icon: Settings },
];

export default function AppShell({ profile, onOpenProfile }: AppShellProps) {
  const { theme, resolvedTheme } = useTheme();
  const { error: noticeError, notices } = useOperationsNotices();
  const pinnedNotice = noticeError ? null : notices.find((notice) => notice.isPinned) ?? null;
  const themeLabel =
    theme === "system"
      ? `시스템 · ${resolvedTheme === "dark" ? "다크" : "라이트"}`
      : theme === "dark"
        ? "다크"
        : "라이트";

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top,rgba(0,160,255,0.14),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(255,135,61,0.12),transparent_22%)]" />

      <header className="sticky top-0 z-40 border-b border-border/70 bg-background/86 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            <NavLink to="/" className="flex min-w-0 flex-col">
              <span className="font-arcade text-sm text-primary">RETRO EMULATOR</span>
              <span className="text-[11px] text-muted-foreground">
                {appEnvironment.siteTagline}
              </span>
            </NavLink>
            <Badge variant="secondary" className="hidden text-[10px] lg:inline-flex">
              테마 {themeLabel}
            </Badge>
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
            <Badge variant="outline" className="text-[10px]">
              API {appEnvironment.apiHostLabel}
            </Badge>
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
      </header>

      {pinnedNotice && (
        <div className="border-b border-primary/20 bg-[linear-gradient(90deg,rgba(0,160,255,0.12),rgba(255,135,61,0.08))]">
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 py-3 lg:flex-row lg:items-center lg:gap-4">
            <div className="flex min-w-0 flex-1 items-start gap-3">
              <Badge variant="secondary" className="mt-0.5 shrink-0 text-[10px]">
                <Pin className="size-3" />
                고정 공지
              </Badge>
              <div className="min-w-0 space-y-1">
                <div className="text-sm font-medium text-foreground">{pinnedNotice.title}</div>
                <div className="truncate text-sm text-muted-foreground">{pinnedNotice.body}</div>
              </div>
            </div>

            <Button asChild variant="secondary" size="sm" className="shrink-0">
              <NavLink to="/notices">
                전체 공지 보기
                <ArrowRight className="size-4" />
              </NavLink>
            </Button>
          </div>
        </div>
      )}

      <main className="mx-auto flex w-full max-w-6xl flex-1 px-4 py-8 lg:py-10">
        <Outlet />
      </main>
    </div>
  );
}
