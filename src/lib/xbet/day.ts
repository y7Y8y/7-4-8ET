import { SPORT_IDS, feedHosts, lineUrl } from "./hosts";
import { baseMarkets, eventKickoff, eventLive, marketsFromGameZip } from "./parse-day";
import { parseEventList, parseGame } from "./parse";
import { getJsonNative, pickHost, type Getter } from "./scrape";
import type { DayLeague, DayLine, DayMatch } from "./day-types";

export type DayOptions = {
  day: string; // YYYY-MM-DD (UTC)
  maxMatches?: number; // plafond d'enrichissement GetGameZip
  concurrency?: number;
  budgetMs?: number;
  hosts?: readonly string[];
  onProgress?: (msg: string) => void;
};

/**
 * Récupère TOUTE la journée 1xBet : toutes les ligues qui jouent ce jour-là,
 * chaque match avec heure, équipes et tous ses marchés.
 *
 * Robustesse :
 *  - budget temps global (liste + enrichissement) → on répond TOUJOURS ;
 *  - un GetGameZip qui échoue ne casse rien : le match garde ses cotes de base ;
 *  - parseur tolérant (codes inconnus, groupes renommés, CV string) ;
 *  - dédoublonnage par id d'événement, matchs sans équipe/heure ignorés.
 */
export async function scrapeDay(getJson: Getter, opts: DayOptions): Promise<DayLine> {
  const maxMatches = opts.maxMatches ?? 220;
  const concurrency = opts.concurrency ?? 6;
  const deadline = Date.now() + (opts.budgetMs ?? 40_000);
  const onProgress = opts.onProgress ?? (() => undefined);
  const { start, end } = dayWindow(opts.day);

  const host = await pickHost(getJson, opts.hosts ?? feedHosts(), deadline - 8_000);
  if (!host) {
    return emptyLine(opts.day, null, "1xBet injoignable. Réessaie dans un instant.");
  }

  // 1. Liste complète par sport (toutes les ligues du jour).
  const raw: ReturnType<typeof parseEventList> = [];
  for (const si of SPORT_IDS) {
    if (Date.now() > deadline) break;
    try {
      const json = await getJson(
        lineUrl(host, "Get1x2_VZip", { sports: si, count: 500, lng: "fr", mode: 4 }),
      );
      raw.push(...parseEventList(json));
    } catch {
      /* sport indispo sur ce skin — on continue */
    }
  }

  const now = Date.now();
  const seen = new Set<number>();
  const matches: DayMatch[] = [];
  for (const ev of raw) {
    if (!ev.I || seen.has(ev.I)) continue;
    seen.add(ev.I);
    const home = (ev.O1 ?? "").trim();
    const away = (ev.O2 ?? "").trim();
    const ko = eventKickoff(ev);
    if (!home || !away || !ko) continue;
    if (/^(à domicile|home)$/i.test(home) || /^(à l['’]extérieur|away)$/i.test(away)) continue;
    const t = ko.getTime();
    if (t < start || t >= end) continue; // pas ce jour-là
    const markets = baseMarkets(ev);
    matches.push({
      id: ev.I,
      sport: (ev.SN ?? ev.SE ?? "Sport").trim(),
      league: (ev.L ?? "").trim() || "Autre",
      home,
      away,
      kickoff: ko.toISOString(),
      started: t <= now,
      live: eventLive(ev),
      markets,
      marketCount: markets.length,
      enriched: false,
    });
  }
  matches.sort((a, b) => a.kickoff.localeCompare(b.kickoff));
  onProgress(`${matches.length} matchs · enrichment des marchés…`);

  if (!matches.length) {
    return emptyLine(opts.day, host, null);
  }

  // 2. Enrichissement : tous les marchés de chaque match (dans le budget).
  const queue = matches.slice(0, maxMatches);
  let enriched = 0;
  let idx = 0;
  let stopped = false;

  const worker = async () => {
    while (true) {
      if (stopped || Date.now() > deadline) {
        stopped = true;
        return;
      }
      const i = idx++;
      if (i >= queue.length) return;
      const m = queue[i];
      try {
        const json = await getJson(
          lineUrl(host, "GetGameZip", {
            id: m.id,
            lng: "fr",
            isSubGames: true,
            GroupEvents: true,
          }),
        );
        const parsed = parseGame(json);
        if (parsed) {
          const markets = marketsFromGameZip(json, m.home, m.away);
          if (markets.length) {
            m.markets = markets;
            m.marketCount = markets.length;
            m.enriched = true;
            enriched += 1;
          }
        }
      } catch {
        /* ce match garde ses cotes de base */
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, queue.length) }, worker));

  const partial = enriched < matches.length;
  if (partial) {
    onProgress(`${enriched}/${matches.length} matchs enrichis (budget temps)`);
  }

  const leagues = groupLeagues(matches);
  return {
    day: opts.day,
    generatedAt: new Date().toISOString(),
    host,
    stats: {
      matches: matches.length,
      leagues: leagues.length,
      markets: matches.reduce((a, m) => a + m.marketCount, 0),
      enriched,
    },
    partial,
    error: null,
    leagues,
  };
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
  for (const l of leagues) {
    l.matches.sort((a, b) => a.kickoff.localeCompare(b.kickoff));
  }
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

/** Scan serveur avec le getter natif (fetch + headers feed). */
export async function scanDayNative(opts: DayOptions) {
  return scrapeDay(getJsonNative, opts);
}
