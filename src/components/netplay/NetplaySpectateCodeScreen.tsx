import { ArrowLeft } from "lucide-react";

import { CodeInput } from "@/components/CodeInput";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface NetplaySpectateCodeScreenProps {
  joinCode: string;
  status: string;
  error: string;
  onBack: () => void;
  onJoinCodeChange: (value: string) => void;
  onSpectateRoom: () => void;
}

export default function NetplaySpectateCodeScreen({
  joinCode,
  status,
  error,
  onBack,
  onJoinCodeChange,
  onSpectateRoom,
}: NetplaySpectateCodeScreenProps) {
  return (
    <Card
      className="flex h-full w-full flex-col border-border/70 bg-card/95"
      data-tutorial="netplay-spectate-code-panel"
    >
      <CardHeader className="flex flex-row items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          className="size-8"
          data-tutorial="spectate-code-back"
          onClick={onBack}
        >
          <ArrowLeft className="size-4" />
        </Button>
        <CardTitle className="text-sm">코드로 관전</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-4">
        <p className="text-xs text-muted-foreground">게임 시작 전 6자리 방 코드를 입력하세요</p>
        <CodeInput value={joinCode} onChange={onJoinCodeChange} onSubmit={onSpectateRoom} />
        <Button className="w-full" onClick={onSpectateRoom} disabled={joinCode.length !== 6}>
          관전자 입장
        </Button>
        {status && <p className="text-xs text-muted-foreground">{status}</p>}
        {error && <p className="text-xs text-destructive-foreground">{error}</p>}
      </CardContent>
    </Card>
  );
}
