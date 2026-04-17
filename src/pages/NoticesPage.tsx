import { Bell, Pin } from "lucide-react";

import { useOperationsNotices } from "@/hooks/useOperationsNotices";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { usePageSeo } from "@/lib/seo";

const publishedAtFormatter = new Intl.DateTimeFormat("ko-KR", {
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export default function NoticesPage() {
  usePageSeo({
    title: "공지사항",
    description: "RTCADE의 운영 공지, 업데이트 소식, 점검 안내를 한곳에서 확인하세요.",
  });

  const { error, isLoading, notices } = useOperationsNotices();
  const pinnedNotice = notices.find((notice) => notice.isPinned) ?? null;

  return (
    <div className="flex w-full flex-col gap-6">
      <Card className="border-border/70 bg-card/95">
        <CardHeader>
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <Bell className="size-4 text-primary" />
            공지사항
          </div>
          <CardTitle className="text-2xl">중요한 안내와 새 소식을 모아봤어요.</CardTitle>
          <CardDescription className="text-sm leading-6">
            중요한 공지는 먼저 보여드리고, 다른 소식은 최신순으로 정리해뒀어요.
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
              아직 올라온 공지가 없어요. 새로운 안내가 생기면 여기에서 바로 확인할 수 있어요.
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
