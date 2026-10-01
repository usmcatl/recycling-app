import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Loads data when the screen gains focus and whenever `deps` change;
 * `reload` can be called after mutations.
 */
export function useData<T>(load: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const loadRef = useRef(load);

  useEffect(() => {
    loadRef.current = load;
  });

  const reload = useCallback(async () => {
    try {
      const value = await loadRef.current();
      setData(value);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  // re-run when the caller's deps change (compared by value)
  const depKey = JSON.stringify(deps);
  useFocusEffect(
    useCallback(() => {
      reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [reload, depKey]),
  );

  return { data, error, loading, reload, setData };
}
