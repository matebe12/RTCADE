import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { UserBadge } from "@/components/UserBadge";
import { NETPLAY_COPY } from "@/netplay/netplayCopy";

export type SessionEndReason = "self-left" | "peer-left";

interface SessionUser {
  nickname: string;
  avatar: string;
}

interface NetplaySessionSummaryProps {
  gameName: string;
  localUser: SessionUser;
  opponentProfile: SessionUser | null;
  durationMs: number;
  startedAt: number | null;
  endReason: SessionEndReason;
  onRematch: () => void;
  onChooseAnotherGame: () => void;
  onGoHome: () => void;
}

function formatDuration(durationMs: number, startedAt: number | null) {
  if (!startedAt || durationMs <= 0) {
    return NETPLAY_COPY.sessionEndedBeforeStart;
  }

  const totalSeconds = Math.max(1, Math.round(durationMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (minutes === 0) {
    return `${seconds}초`;
  }

  return `${minutes}분 ${seconds.toString().padStart(2, "0")}초`;
}

function getEndReasonCopy(endReason: SessionEndReason, startedAt: number | null) {
  if (!startedAt) {
    return endReason === "self-left"
      ? NETPLAY_COPY.sessionEndedBySelfEarly
      : NETPLAY_COPY.sessionEndedByPeerEarly;
  }

  return endReason === "self-left"
    ? NETPLAY_COPY.sessionEndedBySelf
    : NETPLAY_COPY.sessionEndedByPeer;
}

export default function NetplaySessionSummary({
  gameName,
  localUser,
  opponentProfile,
  durationMs,
  startedAt,
  endReason,
  onRematch,
  onChooseAnotherGame,
  onGoHome,
}: NetplaySessionSummaryProps) {
  const remoteUser = opponentProfile ?? { nickname: "상대방", avatar: "🎮" };

  return (
    <Card className="w-full max-w-lg">
      <CardHeader className="items-center text-center">
        <Badge variant="secondary" className="text-[10px]">
          {startedAt ? "플레이 요약" : "준비 종료"}
        </Badge>
        <CardTitle className="text-lg">{gameName}</CardTitle>
        <CardDescription>{getEndReasonCopy(endReason, startedAt)}</CardDescription>
      </CardHeader>

      <CardContent className="space-y-5">
        <div className="flex items-center justify-center gap-3 rounded-lg border border-border/70 bg-background/40 px-4 py-3">
          <UserBadge nickname={localUser.nickname} avatar={localUser.avatar} size="sm" />
          <span className="text-xs font-medium text-muted-foreground">VS</span>
          <UserBadge nickname={remoteUser.nickname} avatar={remoteUser.avatar} size="sm" />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-border/70 bg-background/40 p-4">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">종료 이유</p>
            <p className="mt-2 text-sm font-medium text-foreground">
              {endReason === "self-left"
                ? NETPLAY_COPY.sessionReasonSelf
                : NETPLAY_COPY.sessionReasonPeer}
            </p>
          </div>

          <div className="rounded-lg border border-border/70 bg-background/40 p-4">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">플레이 시간</p>
            <p className="mt-2 text-sm font-medium text-foreground">
              {formatDuration(durationMs, startedAt)}
            </p>
          </div>
        </div>

        <div className="rounded-lg border border-dashed border-border/70 bg-background/20 p-4 text-xs text-muted-foreground">
          {NETPLAY_COPY.sessionHint}
        </div>
      </CardContent>

      <CardFooter className="flex flex-col gap-2 sm:flex-row sm:justify-between">
        <Button className="w-full sm:flex-1" onClick={onRematch}>
          같은 게임으로 새 방 만들기
        </Button>
        <Button variant="outline" className="w-full sm:flex-1" onClick={onChooseAnotherGame}>
          다른 게임 선택
        </Button>
        <Button variant="ghost" className="w-full sm:w-auto" onClick={onGoHome}>
          홈으로
        </Button>
      </CardFooter>
    </Card>
  );
}
