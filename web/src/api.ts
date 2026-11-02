import { createContext, useCallback, useContext, useEffect, useState } from 'react';

export class ApiError extends Error {}

export async function api<T = void>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method: init?.method ?? 'GET',
    headers: init?.body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: init?.body === undefined ? undefined : JSON.stringify(init.body),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new ApiError(body?.error ?? `Request failed (${res.status})`);
  }
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
}

/** Bumped after any sync or link so every mounted query refetches. */
export const DataVersion = createContext<{ version: number; bump: () => void }>({ version: 0, bump: () => {} });

export function useApi<T>(path: string) {
  const { version } = useContext(DataVersion);
  const [state, setState] = useState<{ data?: T; error?: string; loading: boolean }>({ loading: true });
  const [local, setLocal] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setState((s) => ({ ...s, loading: true }));
    api<T>(path).then(
      (data) => !cancelled && setState({ data, loading: false }),
      (err: Error) => !cancelled && setState({ error: err.message, loading: false }),
    );
    return () => {
      cancelled = true;
    };
  }, [path, version, local]);

  const reload = useCallback(() => setLocal((n) => n + 1), []);
  return { ...state, reload };
}
