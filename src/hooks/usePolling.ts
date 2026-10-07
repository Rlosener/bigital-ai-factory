import { useEffect, useRef, useCallback, useState } from "react";

export function usePolling<T>(fetcher: () => Promise<T>, intervalMs: number = 3000, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval>>(undefined);
  const requestSequence = useRef(0);

  const refresh = useCallback(async () => {
    const sequence = ++requestSequence.current;
    try {
      const result = await fetcher();
      if (sequence !== requestSequence.current) return;
      setData(result);
      setError(null);
    } catch (e: unknown) {
      if (sequence !== requestSequence.current) return;
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      if (sequence === requestSequence.current) setLoading(false);
    }
  }, deps);

  useEffect(() => {
    refresh();
    timerRef.current = setInterval(refresh, intervalMs);

    function handleVisibility() {
      clearInterval(timerRef.current);
      if (!document.hidden) {
        refresh();
        timerRef.current = setInterval(refresh, intervalMs);
      }
    }
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      // Invalidate responses started before a scope change or unmount.
      requestSequence.current += 1;
      clearInterval(timerRef.current);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [refresh, intervalMs]);

  return { data, loading, error, refresh };
}
