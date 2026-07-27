import { startTransition, useEffect, useEffectEvent, useState } from "react";

import { fetchNotices, type NoticeItem } from "@/lib/operations-api";

export function useOperationsNotices() {
  const [notices, setNotices] = useState<NoticeItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadNotices = useEffectEvent(async () => {
    try {
      const nextNotices = await fetchNotices();
      startTransition(() => {
        setNotices(nextNotices);
        setError(null);
      });
    } catch {
      startTransition(() => {
        setError("지금은 공지사항을 불러오지 못했습니다.");
      });
    } finally {
      startTransition(() => {
        setIsLoading(false);
      });
    }
  });

  useEffect(() => {
    void loadNotices();
  }, []);

  return {
    error,
    isLoading,
    notices,
  };
}
