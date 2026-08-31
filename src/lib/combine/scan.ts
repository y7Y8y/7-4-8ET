import { cachedCatch } from "../cache";
import { oddsGet, namesMatch, type OddsEvent } from "../providers/odds-api";
import { demoLegs } from "./seed";
import { DEFAULT_PARAMS, type CombineLeg, type CombineParams, type CombineScan } from "./types";
import { inOddBand, stillPrematch } from "./pack";

const SPORTS = [
  "soccer_epl",
  "soccer_spain_la_liga",
  "soccer_italy_serie_a",
  "soccer_germany_bundesliga",
  "soccer_france_ligue_one",
  "soccer_uefa_champs_league",
  "soccer_uefa_europa_league",
  "soccer_efl_champ",
  "soccer_portugal_primeira_liga",
  "soccer_netherlands_eredivisie",
  "soccer_belgium_first_div",
  "soccer_spl",
  "soccer_turkey_super_league",
  "soccer_brazil_campeonato",
  "soccer_mls",
  "soccer_mexico_ligamx",
  "soccer_argentina_primera_division",
  "soccer_japan_j_league",
  "soccer_korea_kleague1",
  "soccer_saudi_arabia_pro_league",
];

function marketFr(key: string) {
  if (key === "h2h") return "1N2";
  if (key === "spreads") return "Handicap asiatique";
  if (key === "totals") return "Total";
  return key;
}

function pickLabel(market: string, name: string, point?: number, home?: string, away?: string) {
  if (market === "h2h") {
    if (namesMatch(name, home ?? "")) return `1 ${name}`;
    if (namesMatch(name, away ?? "")) return `2 ${name}`;
    return name;
  }
  if (market === "spreads") {
    const sign = (point ?? 0) > 0 ? `+${point}` : `${point}`;
    return `${name} ${sign}`;
  }
  if (market === "totals") return `${name} ${point ?? ""}`.trim();
  return name;
}

function extract(ev: OddsEvent, p: CombineParams, now: number) {
  let liveRejected = 0;
  let outOfRange = 0;
  const legs: CombineLeg[] = [];
  if (!stillPrematch(ev.commence_time, p.bufferMin, now)) {
    return { legs, liveRejected: 1, outOfRange: 0 };
  }
  for (const book of ev.bookmakers) {
    if (book.key !== "onexbet" && !/1xbet/i.test(book.title)) continue;
    for (const market of book.markets) {
      for (const o of market.outcomes) {
        if (!inOddBand(o.price, p.oddMin, p.oddMax)) {
          outOfRange += 1;
          continue;
        }
        const matchKey = `${ev.sport_key}:${ev.home_team}:${ev.away_team}:${ev.commence_time}`;
        legs.push({
          id: `${ev.id}-${market.key}-${o.name}-${o.point ?? "x"}`,
          matchKey,
          league: ev.sport_key.replace(/^soccer_/, "").replace(/_/g, " "),
          home: ev.home_team,
          away: ev.away_team,
          kickoff: ev.commence_time,
          market: marketFr(market.key),
          pick: pickLabel(market.key, o.name, o.point, ev.home_team, ev.away_team),
          odd: o.price,
          source: "odds-api",
          bookmaker: "1xBet",
        });
      }
    }
  }
  return { legs, liveRejected, outOfRange };
}

async function pullLive(p: CombineParams): Promise<{ legs: CombineLeg[]; liveRejected: number; outOfRange: number }> {
  const path = (sport: string) =>
    `/sports/${sport}/odds?regions=eu&markets=h2h,spreads,totals&oddsFormat=decimal&bookmakers=onexbet`;
  const chunks = await Promise.allSettled(
    SPORTS.map((s) => oddsGet<OddsEvent[]>(path(s), 10 * 60_000)),
  );
  const now = Date.now();
  let liveRejected = 0;
  let outOfRange = 0;
  const legs: CombineLeg[] = [];
  for (const c of chunks) {
    if (c.status !== "fulfilled") continue;
    for (const ev of c.value) {
      const x = extract(ev, p, now);
      liveRejected += x.liveRejected;
      outOfRange += x.outOfRange;
      legs.push(...x.legs);
    }
  }
  return { legs, liveRejected, outOfRange };
}

export async function scanCombine(p: CombineParams = DEFAULT_PARAMS, forceDemo = false): Promise<CombineScan> {
  const demo = demoLegs();
  if (forceDemo) {
    return {
      scannedAt: new Date().toISOString(),
      source: "demo",
      params: p,
      legs: demo,
      liveRejected: 0,
      outOfRange: 0,
    };
  }
  const live = await cachedCatch("combine:scan", 10 * 60_000, () => pullLive(p), {
    legs: [] as CombineLeg[],
    liveRejected: 0,
    outOfRange: 0,
  });
  const real = live.legs;
  const source = real.length ? (real.length >= 40 ? "odds-api" : "mixed") : "demo";
  const legs = source === "odds-api" ? real : [...real, ...demo];
  return {
    scannedAt: new Date().toISOString(),
    source,
    params: p,
    legs,
    liveRejected: live.liveRejected,
    outOfRange: live.outOfRange,
  };
}

export function parseParams(input: Partial<CombineParams> | null | undefined): CombineParams {
  const clean = Object.fromEntries(
    Object.entries(input ?? {}).filter(([, v]) => v !== undefined),
  ) as Partial<CombineParams>;
  const p = { ...DEFAULT_PARAMS, ...clean };
  p.oddMin = Math.min(p.oddMin, p.oddMax);
  p.oddMax = Math.max(p.oddMin, p.oddMax);
  if (p.oddMin < 1.001) p.oddMin = 1.001;
  if (p.oddMax > 1.05) p.oddMax = 1.05;
  p.target = Math.max(1.2, p.target);
  p.fallback = Math.max(1.2, Math.min(p.fallback, p.target));
  p.bufferMin = Math.max(5, p.bufferMin);
  p.maxLegs = Math.min(400, Math.max(10, p.maxLegs));
  p.minStake = Math.max(1, p.minStake);
  return p;
}
