import { useCallback, useEffect, useState } from 'react';

// Thin in-house query wrapper (decision D10 / M2.1). Isolates components from the
// data source so the mock->real-API swap stays localized. Read-only for now;
// a useMutation counterpart is added when the first writes land (M4/M5).
export interface QueryResult<T> {
  data: T | undefined;
  loading: boolean;
  error: Error | undefined;
  refetch: () => void;
}

/**
 * Run an async loader on mount and whenever `deps` change. Stale results are
 * ignored (last request wins). `deps` are the caller-owned dependency list.
 */
export function useQuery<T>(loader: () => Promise<T>, deps: unknown[]): QueryResult<T> {
  const [data, setData] = useState<T | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | undefined>(undefined);
  const [reloadToken, setReloadToken] = useState(0);

  const refetch = useCallback(() => setReloadToken((t) => t + 1), []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(undefined);
    loader()
      .then((result) => {
        if (active) {
          setData(result);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (active) {
          setError(err instanceof Error ? err : new Error(String(err)));
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
    // Caller owns the dependency list; reloadToken forces a refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, reloadToken]);

  return { data, loading, error, refetch };
}
