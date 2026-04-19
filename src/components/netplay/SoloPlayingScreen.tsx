import type { RefObject } from "react";

import EmulatorPlayer, { type SystemCore } from "@/components/EmulatorPlayer";
import PlayControlsGuide from "@/components/netplay/PlayControlsGuide";
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
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Gamepad2 } from "lucide-react";

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

export default function SoloPlayingScreen({ emulatorRef, onBack, session }: SoloPlayingScreenProps) {
  return (
    <div className="flex w-full flex-col gap-3">
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

      <div className="rounded-lg border border-border/70 bg-background/40 px-4 py-3 text-xs text-muted-foreground">
        서버 ROM을 단독으로 실행 중입니다. 종료하면 플레이 요약으로 이동합니다.
      </div>

      <PlayControlsGuide mode="solo" />

      <EmulatorPlayer
        ref={emulatorRef}
        romSource=""
        core={session.core}
        romPath={session.romPath}
        biosPath={session.biosPath}
      />
    </div>
  );
}
