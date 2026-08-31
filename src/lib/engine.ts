import { hydrate } from "./clock";
import { ymd } from "./format";
import { DETAILS, HIGHLIGHTS, MATCHES, STANDINGS } from "./fallback/seed";
import { ping } from "./http";
import { LEAGUES } from "./leagues";
import { predict, valueBets } from "./model";
import { afStatus } from "./providers/api-football";
import { fdCompetitions } from "./providers/football-data";
import { hlMatches } from "./providers/highlightly";
import { oddsSports } from "./providers/odds-api";
import type {
  Highlight,
  Match,
  MatchDetail,
  ProviderHealth,
  StandingRow,
} from "./types";

function liveNow() {
  return MATCHES.map((m) => hydrate({ ...m, prediction: m.prediction ?? predict(m.home.name, m.away.name) }));
}

export function allMatches(): Match[] {
  return liveNow().sort((a, b) => +new Date(a.kickoff) - +new Date(b.kickoff));
}

export function matchesOn(day: string): Match[] {
  return allMatches().filter((m) => ymd(m.kickoff) === day);
}

export function liveMatches(): Match[] {
  return allMatches().filter((m) => m.status === "live" || m.status === "ht");
}

export function featuredMatch(): Match {
  const live = liveMatches();
  const tonight = allMatches().find((m) => m.id === "villa-arsenal");
  return live[0] ?? tonight ?? allMatches()[0];
}

export function getMatch(id: string): MatchDetail | null {
  const base = allMatches().find((m) => m.id === id);
  if (!base) return null;
  const extra = DETAILS[id] ?? {};
  return { ...base, ...extra };
}

export function standings(leagueId: string): StandingRow[] {
  return STANDINGS[leagueId] ?? [];
}

export function highlights(): Highlight[] {
  return HIGHLIGHTS;
}

export function edges() {
  return valueBets(
    allMatches().filter((m) => m.status === "scheduled" || m.status === "live" || m.status === "ht"),
    0.04,
  );
}

export function predictions() {
  return allMatches()
    .filter((m) => m.status !== "finished")
    .map((m) => ({
      match: m,
      prediction: m.prediction ?? predict(m.home.name, m.away.name),
    }));
}

export async function health(): Promise<ProviderHealth[]> {
  const checks: Array<[ProviderHealth["id"], () => Promise<unknown>]> = [
    ["api-football", () => afStatus()],
    ["football-data", () => fdCompetitions()],
    ["odds-api", () => oddsSports()],
    ["highlightly", () => hlMatches(ymd())],
  ];
  const rows = await Promise.all(
    checks.map(async ([id, fn]) => {
      const r = await ping(fn);
      return { id, ok: r.ok, latencyMs: r.latencyMs, detail: r.detail };
    }),
  );
  return rows;
}

export { LEAGUES };
