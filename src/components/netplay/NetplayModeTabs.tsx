import { Gamepad2, Globe } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { LobbyMode } from "@/stores/useNetplayLobbyStore";
import { cn } from "@/lib/utils";

interface NetplayModeTabsProps {
  disabled?: boolean;
  mode: LobbyMode;
  onModeChange: (mode: LobbyMode) => void;
}

const MODE_ITEMS: Array<{
  description: string;
  icon: typeof Globe;
  label: string;
  value: LobbyMode;
}> = [
  {
    value: "netplay",
    label: "같이하기",
    description: "방 생성, 참가, 공개 방 탐색",
    icon: Globe,
  },
  {
    value: "solo",
    label: "혼자하기",
    description: "서버 ROM을 바로 골라 혼자 플레이",
    icon: Gamepad2,
  },
];

export default function NetplayModeTabs({ disabled = false, mode, onModeChange }: NetplayModeTabsProps) {
  return (
    <div className="grid gap-2 rounded-xl border border-border/70 bg-card/70 p-2 sm:grid-cols-2">
      {MODE_ITEMS.map((item) => {
        const Icon = item.icon;
        const selected = item.value === mode;

        return (
          <Button
            key={item.value}
            type="button"
            variant={selected ? "default" : "ghost"}
            className={cn(
              "h-auto items-start justify-start rounded-lg px-4 py-3 text-left",
              !selected && "text-muted-foreground",
            )}
            disabled={disabled}
            onClick={() => onModeChange(item.value)}
          >
            <div className="flex items-start gap-3">
              <span className="mt-0.5 rounded-full border border-current/20 p-2">
                <Icon className="size-4" />
              </span>
              <span className="flex flex-col gap-1">
                <span className="text-sm font-semibold">{item.label}</span>
                <span className="text-[11px] leading-5 opacity-80">{item.description}</span>
              </span>
            </div>
          </Button>
        );
      })}
    </div>
  );
}
