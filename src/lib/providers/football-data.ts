import { env, hasKey } from "../env";
import { getJson } from "../http";
import { cached } from "../cache";

const BASE = "https://api.football-data.org/v4";

function headers() {
  return { "X-Auth-Token": env.footballData };
}

export async function fdGet<T>(path: string, ttl = 60_000) {
  if (!hasKey("footballData")) throw new Error("football-data.org : clé absente");
  return cached(`fd:${path}`, ttl, () =>
    getJson<T>(`${BASE}${path}`, { headers: headers() }),
  );
}

export async function fdCompetitions() {
  return fdGet<{ competitions: unknown[] }>("/competitions", 6 * 3600_000);
}

export async function fdMatches(dateFrom: string, dateTo: string) {
  return fdGet<{ matches: unknown[] }>(
    `/matches?dateFrom=${dateFrom}&dateTo=${dateTo}`,
    60_000,
  );
}

export async function fdStandings(id: number) {
  return fdGet<{ standings: unknown[] }>(`/competitions/${id}/standings`, 30 * 60_000);
}
