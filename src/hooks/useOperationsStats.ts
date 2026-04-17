import { startTransition, useEffect, useEffectEvent, useState } from "react";

import { fetchOperationsStats, type OperationsStats } from "@/lib/operations-api";

export function useOperationsStats(pollIntervalMs = 15000) {
  const [stats, setStats] = useState<OperationsStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);

  const loadStats = useEffectEvent(async () => {
    try {
      const nextStats = await fetchOperationsStats();
      startTransition(() => {
        setStats(nextStats);
        setError(null);
        setUpdatedAt(Date.now());
      });
    } catch {
      startTransition(() => {
        setError("지금은 이용 현황을 불러오지 못했습니다.");
      });
    } finally {
      startTransition(() => {
        setIsLoading(false);
      });
    }
  });

  useEffect(() => {
    void loadStats();

    const intervalId = window.setInterval(() => {
      void loadStats();
    }, pollIntervalMs);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [pollIntervalMs]);

  return {
    error,
    isLoading,
    stats,
    updatedAt,
  };
}
