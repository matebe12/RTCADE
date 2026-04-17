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
    } catch (caughtError) {
      const message =
        caughtError instanceof Error ? caughtError.message : "운영 지표를 불러오지 못했습니다.";

      startTransition(() => {
        setError(message);
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