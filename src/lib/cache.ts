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
