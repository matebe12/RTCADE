import { Bell, Pin } from "lucide-react";

import { useOperationsNotices } from "@/hooks/useOperationsNotices";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const publishedAtFormatter = new Intl.DateTimeFormat("ko-KR", {
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export default function NoticesPage() {
  const { error, isLoading, notices } = useOperationsNotices();
  const pinnedNotice = notices.find((notice) => notice.isPinned) ?? null;

  return (
    <div className="flex w-full flex-col gap-6">
      <Card className="border-border/70 bg-card/95">
        <CardHeader>
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <Bell className="size-4 text-primary" />
            공지사항 센터
          </div>
          <CardTitle className="text-2xl">
            운영 공지와 제품 업데이트를 실제 데이터로 읽어옵니다.
          </CardTitle>
          <CardDescription className="text-sm leading-6">
            중요한 공지는 상단에 고정되고, 나머지 소식은 시간순으로 확인할 수 있습니다.
          </CardDescription>
        </CardHeader>
      </Card>

      {pinnedNotice && (
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-[10px]">
                <Pin className="size-3" />
                상단 고정
              </Badge>
              <CardTitle className="text-lg">{pinnedNotice.title}</CardTitle>
            </div>
            <CardDescription>
              {publishedAtFormatter.format(new Date(pinnedNotice.publishedAt))}
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm leading-7 text-muted-foreground">
            {pinnedNotice.body}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4">
        {isLoading ? (
          <Card className="border-border/70 bg-card/95">
            <CardContent className="p-6 text-sm text-muted-foreground">
              공지사항을 불러오는 중입니다.
            </CardContent>
          </Card>
        ) : error ? (
          <Card className="border-border/70 bg-card/95">
            <CardContent className="p-6 text-sm text-muted-foreground">{error}</CardContent>
          </Card>
        ) : notices.length === 0 ? (
          <Card className="border-border/70 bg-card/95">
            <CardContent className="p-6 text-sm text-muted-foreground">
              아직 게시된 공지가 없습니다. 운영 공지가 발행되면 이 목록에 시간순으로 표시됩니다.
            </CardContent>
          </Card>
        ) : (
          notices.map((notice) => (
            <Card key={notice.id} className="border-border/70 bg-card/95">
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      {notice.isPinned && (
                        <Badge variant="secondary" className="text-[10px]">
                          <Pin className="size-3" />
                          고정
                        </Badge>
                      )}
                      <CardTitle className="text-lg">{notice.title}</CardTitle>
                    </div>
                    <CardDescription>
                      {publishedAtFormatter.format(new Date(notice.publishedAt))}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="text-sm leading-7 text-muted-foreground">
                {notice.body}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
