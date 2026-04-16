import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import NetplayLobby from "@/components/NetplayLobby";

export default function NetplayPage() {
  return (
    <div className="flex w-full flex-col gap-6">
      <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
        <Card className="border-border/70 bg-card/95">
          <CardHeader className="space-y-4">
            <Badge variant="secondary" className="w-fit text-[10px]">
              Netplay Workspace
            </Badge>
            <div className="space-y-2">
              <CardTitle className="text-2xl">
                매칭, 채팅, 공개 방까지 한 화면에서 이어집니다.
              </CardTitle>
              <CardDescription className="text-sm leading-6">
                현재 로비는 기능이 풍부하지만 파일 경계가 크기 때문에, 이번 리팩터에서는 이 화면을
                session router와 독립 screen 컴포넌트로 나누는 작업을 시작합니다.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <div className="rounded-lg border border-border/70 bg-background/40 p-4">
              1. 메뉴, 공개 방, 대기, 플레이, 세션 요약을 각각 분리된 screen 컴포넌트로 분해
            </div>
            <div className="rounded-lg border border-border/70 bg-background/40 p-4">
              2. P2P, 채팅, 리싱크, 최근 기록을 훅 또는 컨텍스트 경계로 이동
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-center lg:justify-end">
          <NetplayLobby />
        </div>
      </div>
    </div>
  );
}
