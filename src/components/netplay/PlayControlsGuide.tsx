import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface PlayControlsGuideProps {
  mode: "netplay" | "solo";
  className?: string;
}

const CONTROLS_GUIDE_COLLAPSED_KEY = "rtcade_play_controls_collapsed";

const CONTROL_GROUPS = [
  {
    label: "이동",
    keys: ["↑", "↓", "←", "→"],
    description: "방향키",
  },
  {
    label: "기본 버튼",
    keys: ["A", "S", "D", "F"],
    description: "주요 액션 4버튼",
  },
  {
    label: "시작 / 선택",
    keys: ["1", "5"],
    description: "시작, 선택/코인",
  },
  {
    label: "보조 버튼",
    keys: ["Q", "E"],
    description: "L / R 버튼",
  },
] as const;

function KeyBadge({ value }: { value: string }) {
  return (
    <span className="inline-flex min-w-8 items-center justify-center rounded-md border border-border/70 bg-background px-2 py-1 text-[11px] font-semibold text-foreground shadow-sm">
      {value}
    </span>
  );
}

export default function PlayControlsGuide({ mode, className }: PlayControlsGuideProps) {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const storedValue = window.localStorage.getItem(CONTROLS_GUIDE_COLLAPSED_KEY);
    setCollapsed(storedValue === "true");
  }, []);

  const handleToggle = () => {
    const nextCollapsed = !collapsed;
    setCollapsed(nextCollapsed);

    if (typeof window !== "undefined") {
      window.localStorage.setItem(CONTROLS_GUIDE_COLLAPSED_KEY, String(nextCollapsed));
    }
  };

  return (
    <Card className={cn("w-[800px] max-w-[95vw] border-border/70 bg-card/95", className)}>
      <CardHeader className="flex flex-row items-center justify-between gap-3 pb-3">
        <div className="space-y-1">
          <CardTitle className="text-sm">키 안내</CardTitle>
          <p className="text-xs text-muted-foreground">
            {mode === "netplay"
              ? "같이하기와 동일한 키 배치입니다. 게임 화면을 먼저 클릭한 뒤 입력하세요."
              : "혼자하기도 넷플레이와 동일한 키 배치를 사용합니다. 게임 화면을 먼저 클릭한 뒤 입력하세요."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-[10px]">
            공통 키맵
          </Badge>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 gap-1 text-[11px]"
            onClick={handleToggle}
          >
            {collapsed ? "펼치기" : "접기"}
            <ChevronDown className={cn("size-3 transition-transform", !collapsed && "rotate-180")} />
          </Button>
        </div>
      </CardHeader>
      {!collapsed && (
        <CardContent className="space-y-3">
          <div className="flex gap-3 overflow-x-auto pb-1">
            {CONTROL_GROUPS.map((group) => (
              <div
                key={group.label}
                className="min-w-[168px] shrink-0 rounded-lg border border-border/70 bg-background/40 p-3"
              >
                <div className="text-xs font-medium text-foreground">{group.label}</div>
                <div className="mt-2 flex flex-nowrap gap-2 whitespace-nowrap">
                  {group.keys.map((key) => (
                    <KeyBadge key={`${group.label}-${key}`} value={key} />
                  ))}
                </div>
                <div className="mt-2 text-[11px] text-muted-foreground">{group.description}</div>
              </div>
            ))}
          </div>

          {mode === "netplay" && (
            <div className="rounded-lg border border-dashed border-border/70 bg-background/20 p-3 text-[11px] text-muted-foreground">
              채팅은 <span className="font-semibold text-foreground">Enter</span>로 빠르게 열 수 있습니다.
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
