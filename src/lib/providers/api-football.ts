import { env, hasKey } from "../env";
import { getJson } from "../http";
import { cached } from "../cache";

const BASE = "https://v3.football.api-sports.io";

type AfEnvelope<T> = { response: T; errors?: unknown };

function headers() {
  return { "x-apisports-key": env.apiFootball };
}

export async function afGet<T>(path: string, ttl = 60_000) {
  if (!hasKey("apiFootball")) throw new Error("API-Football : clé absente");
  return cached(`af:${path}`, ttl, () =>
    getJson<AfEnvelope<T>>(`${BASE}${path}`, { headers: headers() }),
  );
}

export async function afStatus() {
  return afGet<unknown>("/status", 30_000);
}

export async function afFixtures(date: string) {
  return afGet<unknown[]>(`/fixtures?date=${date}`, 45_000);
}

export async function afPredictions(fixtureId: number) {
  return afGet<unknown[]>(`/predictions?fixture=${fixtureId}`, 6 * 3600_000);
}

export async function afStandings(league: number, season: number) {
  return afGet<unknown[]>(`/standings?league=${league}&season=${season}`, 30 * 60_000);
}
