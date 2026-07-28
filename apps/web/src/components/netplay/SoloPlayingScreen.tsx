import type { RefObject } from "react";
import { useCallback, useState, useEffect, useRef } from "react";
import { toast } from "sonner";

import EmulatorPlayer, { type SystemCore } from "@/components/EmulatorPlayer";
import PlayControlsGuide from "@/components/netplay/PlayControlsGuide";
import VirtualGamepad from "@/components/VirtualGamepad";
import { useMobileDetect } from "@/hooks/useMobileDetect";
import { sendLocalFBNeoInput, sendLocalMameInput } from "@rtcade/emulator";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@rtcade/ui";
import { Badge } from "@rtcade/ui";
import { Button } from "@rtcade/ui";
import { ArrowLeft, Gamepad2, Minimize2 } from "lucide-react";
import { cn } from "@rtcade/ui";

interface SoloPlayingSession {
  biosPath?: string;
  core: SystemCore;
  romPath: string;
}

interface SoloPlayingScreenProps {
  emulatorRef: RefObject<HTMLDivElement | null>;
  onBack: () => void;
  session: SoloPlayingSession;
}

export default function SoloPlayingScreen({
  emulatorRef,
  onBack,
  session,
}: SoloPlayingScreenProps) {
  const isMobile = useMobileDetect();
  const [isMaximized, setIsMaximized] = useState(false);

  // 모바일 최대화 시 AppShell 헤더/nav 숨김
  useEffect(() => {
    if (isMaximized) {
      document.body.classList.add("mobile-maximized");
    } else {
      document.body.classList.remove("mobile-maximized");
    }
    return () => { document.body.classList.remove("mobile-maximized"); };
  }, [isMaximized]);

  // Android 뒤로가기 두 번 터치로 종료
  const backPressTimer = useRef(0);
  useEffect(() => {
    history.pushState(null, "", location.href);
    const handler = () => {
      const now = Date.now();
      if (now - backPressTimer.current < 2000) {
        onBack();
      } else {
        backPressTimer.current = now;
        history.pushState(null, "", location.href);
        toast("뒤로가기를 한 번 더 누르면 종료됩니다");
      }
    };
    window.addEventListener("popstate", handler);
    return () => window.removeEventListener("popstate", handler);
  }, [onBack]);

  const handleVirtualInput = useCallback(
    (button: number, down: boolean) => {
      if (session.core === "mame2003") {
        sendLocalMameInput(button, down);
      } else {
        sendLocalFBNeoInput(button, down);
      }
    },
    [session.core],
  );

  return (
    <div className={cn("flex w-full flex-col", isMaximized ? "gap-5" : "gap-3")}>
      {/* Toolbar — 모바일 최대화 시 숨김 */}
      {!isMaximized && (
          <div className="flex w-full flex-wrap items-center gap-3">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="sm" className="text-xs">
                  <ArrowLeft className="mr-1 size-3" />
                  나가기
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>혼자하기 종료</AlertDialogTitle>
                  <AlertDialogDescription>
                    정말 나가시겠습니까? 현재 진행 중인 혼자 플레이가 종료됩니다.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>취소</AlertDialogCancel>
                  <AlertDialogAction onClick={onBack}>나가기</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
              <Badge variant="secondary" className="gap-1 text-[10px]">
                <Gamepad2 className="size-3" />
                혼자하기
              </Badge>
            </div>
          </div>
      )}

      {!isMobile && <PlayControlsGuide mode="solo" dataTutorial="play-controls-guide" />}

      <div
        data-tutorial="solo-emulator-stage"
        className={cn(isMobile ? (isMaximized ? "relative flex-[0_0_50%] min-h-0" : "flex-1 min-h-0 max-h-[55vh]") : "")}
      >
        {/* 최대화 모드 나가기 버튼 (캔버스 내) */}
        {isMaximized && (
          <div className="absolute right-3 top-3 z-50">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="h-8 w-8 rounded-full bg-black/60 p-0 text-white backdrop-blur-sm hover:bg-black/80"
              onClick={() => setIsMaximized(false)}
              title="최대화 종료"
            >
              <Minimize2 className="size-3.5" />
            </Button>
          </div>
        )}

        <EmulatorPlayer
          ref={emulatorRef}
          romSource=""
          core={session.core}
          romPath={session.romPath}
          biosPath={session.biosPath}
          hideFullscreen={isMobile}
          onMaximize={isMobile && !isMaximized ? () => setIsMaximized(true) : undefined}
        />
      </div>

      {/* Virtual gamepad — mobile only, always visible */}
      {isMobile && (
        <div className={cn("virtual-gamepad w-full pb-safe flex items-center", isMaximized ? "flex-1 min-h-0 pt-3" : "flex-shrink-0")}>
          <VirtualGamepad onLocalInput={handleVirtualInput} active />
        </div>
      )}
    </div>
  );
}
