import { feedHosts, lineUrl } from "./hosts";
import { eventKickoff, marketsFromGameZip } from "./parse-day";
import { getJsonNative, gameZipUrl, leaguesFromTree, parseChampGames, pickHostWithTree, type Getter } from "./scrape";
import type { DayLeague, DayLine, DayMatch } from "./day-types";

export type DayOptions = {
  day: string; // YYYY-MM-DD (UTC)
  maxMatches?: number; // plafale d'enrichissement GetGameZip
  maxLeagues?: number;
  concurrency?: number;
  budgetMs?: number;
  hosts?: readonly string[];
  onProgress?: (msg: string) => void;
};

/**
 * Ligne du jour complète : toutes les ligues qui jouent ce jour-là, chaque match
 * avec heure, équipes et tous ses marchés — sur les endpoints NON verrouillés
 * (GetSportsZip → GetChampZip → GetGameZip), donc 100 % côté serveur.
 */
export async function scrapeDay(getJson: Getter, opts: DayOptions): Promise<DayLine> {
  const maxMatches = opts.maxMatches ?? 220;
  const maxLeagues = opts.maxLeagues ?? 60;
  const concurrency = opts.concurrency ?? 6;
  const deadline = Date.now() + (opts.budgetMs ?? 40_000);
  const onProgress = opts.onProgress ?? (() => undefined);
  const { start, end } = dayWindow(opts.day);

  const picked = await pickHostWithTree(getJson, opts.hosts ?? feedHosts(), deadline - 8_000);
  if (!picked) return emptyLine(opts.day, null, "1xBet injoignable. Réessaie dans un instant.");
  const { host, sports } = picked;

  const leagues = leaguesFromTree(sports, maxLeagues);
  const now = Date.now();
  const seen = new Set<number>();
  const matches: DayMatch[] = [];
  let leagueStop = false;

  type Raw = { id: number; sport: string; league: string; home: string; away: string; kickoff: string; base: DayMatch["markets"] };
  const raws: Raw[] = [];

  await runPool(leagues, Math.min(concurrency, 4), async (lg) => {
    if (leagueStop || Date.now() > deadline) {
      leagueStop = true;
      return;
    }
    try {
      const json = await getJson(lineUrl(host, "GetChampZip", { champ: lg.li, top: false }));
      for (const g of parseChampGames(json)) {
        if (!g?.I || seen.has(g.I)) continue;
        const home = (g.O1 ?? "").trim();
        const away = (g.O2 ?? "").trim();
        const ko = eventKickoff(g as never);
        if (!home || !away || !ko) continue;
        if (/^(à domicile|home)$/i.test(home) || /^(à l['’]extérieur|away)$/i.test(away)) continue;
        const t = ko.getTime();
        if (t < start || t >= end) continue;
        seen.add(g.I);
        raws.push({
          id: g.I,
          sport: (g.SN ?? g.SE ?? lg.sportName).trim(),
          league: (g.L ?? g.LE ?? lg.name).trim() || "Autre",
          home,
          away,
          kickoff: ko.toISOString(),
          base: [],
        });
      }
    } catch {
      /* ligue indisponible */
    }
  });

  raws.sort((a, b) => a.kickoff.localeCompare(b.kickoff));
  for (const r of raws) {
    const t = Date.parse(r.kickoff);
    matches.push({
      id: r.id,
      sport: r.sport,
      league: r.league,
      home: r.home,
      away: r.away,
      kickoff: r.kickoff,
      started: t <= now,
      live: t <= now && now - t < 3 * 3600_000, // le zip de ligue n'a pas de SC — approximation
      markets: r.base,
      marketCount: r.base.length,
      enriched: false,
    });
  }
  onProgress(`${matches.length} matchs · enrichissement des marchés…`);

  if (!matches.length) return withStats(emptyLine(opts.day, host, null), matches);

  /* Enrichissement : tous les marchés de chaque match, dans le budget. */
  const queue = matches.slice(0, maxMatches);
  let enriched = 0;
  let stop = false;
  await runPool(queue, concurrency, async (m) => {
    if (stop || Date.now() > deadline) {
      stop = true;
      return;
    }
    try {
      const json = await getJson(gameZipUrl(host, m.id));
      const markets = marketsFromGameZip(json, m.home, m.away);
      if (markets.length) {
        m.markets = markets;
        m.marketCount = markets.length;
        m.enriched = true;
        enriched += 1;
      }
    } catch {
      /* le match garde ses cotes de base */
    }
  });

  const partial = enriched < matches.length;
  const line: DayLine = {
    day: opts.day,
    generatedAt: new Date().toISOString(),
    host,
    stats: {
      matches: matches.length,
      leagues: 0,
      markets: matches.reduce((a, m) => a + m.marketCount, 0),
      enriched,
    },
    partial,
    error: null,
    leagues: [],
  };
  line.leagues = groupLeagues(matches);
  line.stats.leagues = line.leagues.length;
  return line;
}

async function runPool<T>(items: T[], n: number, fn: (item: T) => Promise<void>) {
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      await fn(items[idx]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, worker));
}

function groupLeagues(matches: DayMatch[]): DayLeague[] {
  const map = new Map<string, DayLeague>();
  for (const m of matches) {
    const key = `${m.sport}||${m.league}`;
    let l = map.get(key);
    if (!l) {
      l = { sport: m.sport, league: m.league, matches: [] };
      map.set(key, l);
    }
    l.matches.push(m);
  }
  const leagues = [...map.values()];
  for (const l of leagues) l.matches.sort((a, b) => a.kickoff.localeCompare(b.kickoff));
  leagues.sort((a, b) => {
    const fa = a.sport.toLowerCase() === "football" ? 0 : 1;
    const fb = b.sport.toLowerCase() === "football" ? 0 : 1;
    if (fa !== fb) return fa - fb;
    return a.league.localeCompare(b.league, "fr");
  });
  return leagues;
}

function dayWindow(day: string) {
  const start = Date.parse(`${day}T00:00:00.000Z`);
  if (!Number.isFinite(start)) throw new Error(`jour invalide : ${day}`);
  return { start, end: start + 24 * 3600 * 1000 };
}

function emptyLine(day: string, host: string | null, error: string | null): DayLine {
  return {
    day,
    generatedAt: new Date().toISOString(),
    host,
    stats: { matches: 0, leagues: 0, markets: 0, enriched: 0 },
    partial: false,
    error,
    leagues: [],
  };
}

function withStats(line: DayLine, matches: DayMatch[]): DayLine {
  line.stats.matches = matches.length;
  return line;
}

/** Scan serveur avec le getter natif. */
export async function scanDayNative(opts: DayOptions) {
  return scrapeDay(getJsonNative, opts);
}
