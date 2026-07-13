import { useCallback, useState } from 'react';

// Companion to useQuery for writes (arrives with the first mutations, M4). Keeps
// components isolated from the data source so the mock->real-API swap stays local.
// Variadic args mirror the underlying service function's parameters.
export interface MutationResult<TArgs extends unknown[], TData> {
  mutate: (...args: TArgs) => Promise<TData>;
  data: TData | undefined;
  loading: boolean;
  error: Error | undefined;
}

export function useMutation<TArgs extends unknown[], TData>(
  fn: (...args: TArgs) => Promise<TData>,
): MutationResult<TArgs, TData> {
  const [data, setData] = useState<TData | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | undefined>(undefined);

  const mutate = useCallback(
    async (...args: TArgs): Promise<TData> => {
      setLoading(true);
      setError(undefined);
      try {
        const result = await fn(...args);
        setData(result);
        return result;
      } catch (err) {
        const normalized = err instanceof Error ? err : new Error(String(err));
        setError(normalized);
        throw normalized;
      } finally {
        setLoading(false);
      }
    },
    [fn],
  );

  return { mutate, data, loading, error };
}
