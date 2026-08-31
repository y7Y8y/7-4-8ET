export async function getJson<T>(
  url: string,
  init: RequestInit & { timeoutMs?: number } = {},
): Promise<T> {
  const { timeoutMs = 4500, ...rest } = init;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      ...rest,
      signal: ctrl.signal,
      cache: "no-store",
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} ${url}`);
    }
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

export async function ping(fn: () => Promise<unknown>): Promise<{
  ok: boolean;
  latencyMs: number;
  detail: string;
}> {
  const t0 = Date.now();
  try {
    await fn();
    return { ok: true, latencyMs: Date.now() - t0, detail: "ok" };
  } catch (err) {
    return {
      ok: false,
      latencyMs: Date.now() - t0,
      detail: err instanceof Error ? err.message : "erreur",
    };
  }
}
