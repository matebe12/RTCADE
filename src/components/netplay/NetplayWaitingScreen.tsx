import { ArrowLeft, Globe, Loader2, Lock } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RoomCodeDisplay } from "@/components/RoomCodeDisplay";
import { parseRomName } from "@/lib/game-names";

interface NetplayWaitingScreenProps {
  roomCode: string;
  romFilename: string;
  core: string;
  isPublic?: boolean;
  status: string;
  onBack: () => void;
}

export default function NetplayWaitingScreen({
  roomCode,
  romFilename,
  core,
  isPublic,
  status,
  onBack,
}: NetplayWaitingScreenProps) {
  return (
    <Card className="w-full max-w-sm">
      <CardHeader className="flex flex-row items-center gap-3">
        <Button variant="ghost" size="icon" className="size-8" onClick={onBack}>
          <ArrowLeft className="size-4" />
        </Button>
        <CardTitle className="text-sm">대기 중</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-4">
        <p className="text-xs text-muted-foreground">
          {isPublic ? "공개 방 목록에도 노출되고 있습니다" : "방 코드를 상대방에게 알려주세요"}
        </p>
        <RoomCodeDisplay code={roomCode} />
        <Badge variant="secondary" className="gap-1 text-[10px]">
          {isPublic ? <Globe className="size-3" /> : <Lock className="size-3" />}
          {isPublic ? "공개 방" : "초대 코드 방"}
        </Badge>
        <div className="flex items-center gap-2">
          <Loader2 className="size-3 animate-spin text-muted-foreground" />
          <span className="text-xs text-muted-foreground">{status || "상대방 대기 중..."}</span>
        </div>
        <Badge variant="secondary" className="text-[10px]">
          {parseRomName(romFilename, core)}
        </Badge>
      </CardContent>
    </Card>
  );
}
