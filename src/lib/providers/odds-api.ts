import { env, hasKey } from "../env";
import { getJson } from "../http";
import { cached, cachedCatch } from "../cache";
import type { OddsQuote } from "../types";

const BASE = "https://api.the-odds-api.com/v4";

const BOOKS = "onexbet,pinnacle,bet365,unibet_fr,winamax_fr,betclic_fr";
const SPORTS = [
  "soccer_epl",
  "soccer_spain_la_liga",
  "soccer_italy_serie_a",
  "soccer_france_ligue_one",
  "soccer_portugal_primeira_liga",
];

type Outcome = { name: string; price: number; point?: number };
type Market = { key: string; outcomes: Outcome[] };
type Book = { key: string; title: string; markets: Market[] };
export type OddsEvent = {
  id: string;
  sport_key: string;
  commence_time: string;
  home_team: string;
  away_team: string;
  bookmakers: Book[];
};

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
  return oddsGet<OddsEvent[]>(
    `/sports/${sportKey}/odds?regions=eu&markets=h2h,totals&oddsFormat=decimal&bookmakers=${BOOKS}`,
    180_000,
  );
}

export async function fetchEuOdds(): Promise<OddsEvent[]> {
  return cachedCatch(
    "odds:eu-bundle",
    180_000,
    async () => {
      const chunks = await Promise.allSettled(SPORTS.map((s) => oddsSoccer(s)));
      return chunks.flatMap((c) => (c.status === "fulfilled" ? c.value : []));
    },
    [],
  );
}

function h2h(book: Book, home: string, away: string): OddsQuote | null {
  const m = book.markets.find((x) => x.key === "h2h");
  if (!m) return null;
  const h = m.outcomes.find((o) => o.name === home)?.price;
  const a = m.outcomes.find((o) => o.name === away)?.price;
  const d = m.outcomes.find((o) => /draw|nul|tie/i.test(o.name))?.price;
  if (!h || !a || !d) return null;
  const totals = book.markets.find((x) => x.key === "totals");
  const over = totals?.outcomes.find((o) => o.name === "Over" && o.point === 2.5)?.price;
  const under = totals?.outcomes.find((o) => o.name === "Under" && o.point === 2.5)?.price;
  return {
    bookmaker: book.key === "onexbet" ? "1xBet" : book.title,
    home: h,
    draw: d,
    away: a,
    over25: over,
    under25: under,
  };
}

export function quotesForEvent(ev: OddsEvent): OddsQuote[] {
  const rows = ev.bookmakers
    .map((b) => h2h(b, ev.home_team, ev.away_team))
    .filter((x): x is OddsQuote => Boolean(x));
  rows.sort((a, b) => (a.bookmaker === "1xBet" ? -1 : b.bookmaker === "1xBet" ? 1 : 0));
  return rows;
}

export function normName(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\b(fc|cf|afc|sc|ssc|ac|as|rc|ogc|ud|cd)\b/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function namesMatch(a: string, b: string) {
  const x = normName(a);
  const y = normName(b);
  return x === y || x.includes(y) || y.includes(x);
}
