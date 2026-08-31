import { env, hasKey } from "../env";
import { getJson } from "../http";
import { cached } from "../cache";

const BASE = "https://api.the-odds-api.com/v4";

export async function oddsGet<T>(path: string, ttl = 120_000) {
  if (!hasKey("oddsApi")) throw new Error("The Odds API : clé absente");
  const join = path.includes("?") ? "&" : "?";
  return cached(`odds:${path}`, ttl, () =>
    getJson<T>(`${BASE}${path}${join}apiKey=${env.oddsApi}`),
  );
}

export async function oddsSports() {
  return oddsGet<unknown[]>("/sports", 6 * 3600_000);
}

export async function oddsSoccer(sportKey: string) {
  return oddsGet<unknown[]>(
    `/sports/${sportKey}/odds?regions=eu&markets=h2h,totals&oddsFormat=decimal`,
    180_000,
  );
}
