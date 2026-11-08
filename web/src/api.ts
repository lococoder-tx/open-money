export async function api<T = void>(
  path: string,
  init?: { method?: string; body?: unknown },
): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method: init?.method ?? 'GET',
    headers:
      init?.body === undefined
        ? undefined
        : { 'Content-Type': 'application/json' },
    body: init?.body === undefined ? undefined : JSON.stringify(init.body),
  })
  if (!res.ok) {
    const body: unknown = await res.json().catch(() => null)
    throw new Error(
      typeof body === 'object' &&
        body !== null &&
        'error' in body &&
        typeof body.error === 'string'
        ? body.error
        : `Request failed (${res.status})`,
    )
  }
  // The server and this client compile against the same @rocket/shared types,
  // so the response is trusted rather than re-parsed here.
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T)
}

export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}
