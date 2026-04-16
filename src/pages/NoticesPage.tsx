import { Bell, Pin } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const placeholderNotices = [
  {
    title: "상단 고정 공지 슬롯",
    description: "긴급 점검, 배포 안내, 시즌 이벤트 같은 운영 공지가 항상 최상단에 노출됩니다.",
    pinned: true,
  },
  {
    title: "일반 공지 목록",
    description: "패치 노트, 신규 기능 안내, ROM 정책 변경 같은 공지가 시간순으로 쌓일 자리입니다.",
    pinned: false,
  },
  {
    title: "향후 관리자 발행 API",
    description: "1차는 읽기 전용 노출만 제공하고, 관리자 작성 UI는 후속 단계로 분리합니다.",
    pinned: false,
  },
];

export default function NoticesPage() {
  return (
    <div className="flex w-full flex-col gap-6">
      <Card className="border-border/70 bg-card/95">
        <CardHeader>
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <Bell className="size-4 text-primary" />
            공지사항 센터
          </div>
          <CardTitle className="text-2xl">운영 공지와 제품 업데이트가 들어갈 자리입니다.</CardTitle>
          <CardDescription className="text-sm leading-6">
            이번 리팩터 1차 범위는 읽기 전용 노출과 상단 고정 공지까지입니다. 작성 UI와 권한 모델은
            이후 단계로 둡니다.
          </CardDescription>
        </CardHeader>
      </Card>

      <div className="grid gap-4">
        {placeholderNotices.map((notice) => (
          <Card key={notice.title} className="border-border/70 bg-card/95">
            <CardHeader>
              <div className="flex items-center gap-2">
                {notice.pinned && (
                  <Badge variant="secondary" className="text-[10px]">
                    <Pin className="size-3" />
                    고정
                  </Badge>
                )}
                <CardTitle className="text-lg">{notice.title}</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              {notice.description}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
