import { ArrowLeft } from "lucide-react";

import { CodeInput } from "@/components/CodeInput";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface NetplayJoinRoomScreenProps {
  joinCode: string;
  status: string;
  error: string;
  onBack: () => void;
  onJoinCodeChange: (value: string) => void;
  onJoinRoom: () => void;
}

export default function NetplayJoinRoomScreen({
  joinCode,
  status,
  error,
  onBack,
  onJoinCodeChange,
  onJoinRoom,
}: NetplayJoinRoomScreenProps) {
  return (
    <Card className="w-full max-w-sm">
      <CardHeader className="flex flex-row items-center gap-3">
        <Button variant="ghost" size="icon" className="size-8" onClick={onBack}>
          <ArrowLeft className="size-4" />
        </Button>
        <CardTitle className="text-sm">방 참가</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-4">
        <p className="text-xs text-muted-foreground">6자리 방 코드를 입력하세요</p>
        <CodeInput value={joinCode} onChange={onJoinCodeChange} onSubmit={onJoinRoom} />
        <Button className="w-full" onClick={onJoinRoom} disabled={joinCode.length !== 6}>
          참가
        </Button>
        {status && <p className="text-xs text-muted-foreground">{status}</p>}
        {error && <p className="text-xs text-destructive-foreground">{error}</p>}
      </CardContent>
    </Card>
  );
}
