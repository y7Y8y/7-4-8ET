import { env, hasKey } from "../env";
import { getJson } from "../http";
import { cached } from "../cache";

const BASE = "https://sports.highlightly.net";

function headers() {
  return { "x-rapidapi-key": env.highlightly };
}

export async function hlGet<T>(path: string, ttl = 60_000) {
  if (!hasKey("highlightly")) throw new Error("Highlightly : clé absente");
  return cached(`hl:${path}`, ttl, () =>
    getJson<T>(`${BASE}${path}`, { headers: headers() }),
  );
}

export async function hlMatches(date: string) {
  return hlGet<{ data?: unknown[] }>(`/football/matches?date=${date}&limit=80`, 45_000);
}

export async function hlHighlights(date: string) {
  return hlGet<{ data?: unknown[] }>(`/football/highlights?date=${date}&limit=24`, 10 * 60_000);
}
