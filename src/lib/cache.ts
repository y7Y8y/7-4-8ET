type Entry<T> = { exp: number; value: T };

const store = new Map<string, Entry<unknown>>();

export function cached<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const hit = store.get(key);
  if (hit && hit.exp > Date.now()) return Promise.resolve(hit.value as T);
  return fn().then((value) => {
    store.set(key, { exp: Date.now() + ttlMs, value });
    return value;
  });
}

export function peek<T>(key: string): T | null {
  const hit = store.get(key);
  if (!hit || hit.exp <= Date.now()) return null;
  return hit.value as T;
}

export async function cachedCatch<T>(key: string, ttlMs: number, fn: () => Promise<T>, fallback: T): Promise<T> {
  const hit = peek<T>(key);
  if (hit !== null) return hit;
  try {
    return await cached(key, ttlMs, fn);
  } catch {
    store.set(key, { exp: Date.now() + 30_000, value: fallback });
    return fallback;
  }
}
