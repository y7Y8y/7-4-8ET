import { SPORT_IDS, feedHeaders, feedHosts, lineUrl } from "./hosts";
import { eventKickoff, isPrematch, legsFromEvent, onePerMatch, parseGame } from "./parse";
import { dayWindowsUtc, inDayWindows } from "./days";
import { SCAN_DEFAULTS, type ScanParams, type XbetLeg } from "./types";

export type Progress = (msg: string) => void;

export type Getter = (url: string) => Promise<unknown>;

export type ScrapeResult = {
  ok: boolean;
  host: string | null;
  legs: XbetLeg[];
  events: number;
  games: number;
  error: string | null;
};

/* ── Schéma du feed BetB2B (endpoints non verrouillés) ── */

export type LeagueNode = { L?: string; LI?: number; GC?: number };
export type SportNode = { I?: number; N?: string; E?: string; L?: LeagueNode[] };

type EventZipLike = {
  I: number;
  O1?: string;
  O2?: string;
  L?: string;
  LE?: string;
  SN?: string;
  SE?: string;
  S?: number;
  E?: unknown;
};

export function parseSportsTree(json: unknown): SportNode[] {
  if (!json || typeof json !== "object") return [];
  const v = (json as { Value?: unknown }).Value;
  return Array.isArray(v) ? (v as SportNode[]) : [];
}

export function parseChampGames(json: unknown): EventZipLike[] {
  if (!json || typeof json !== "object") return [];
  const v = (json as { Value?: unknown }).Value;
  if (!v || typeof v !== "object" || Array.isArray(v)) return [];
  const g = (v as { G?: unknown }).G;
  return Array.isArray(g) ? (g as EventZipLike[]) : [];
}

/** URL du zip complet d'un match (tous ses marchés). */
export function gameZipUrl(host: string, id: number) {
  return lineUrl(host, "GetGameZip", {
    id,
    isNewBuilder: true,
    GroupEvents: true,
    marketType: 1,
    countevents: 250,
  });
}

async function mapPool<T, R>(items: T[], n: number, fn: (item: T, i: number) => Promise<R>) {
  const out: R[] = new Array(items.length);
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx], idx);
    }
  }
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, () => worker()));
  return out;
}

export async function getJsonNative(url: string, timeoutMs = 12000): Promise<unknown> {
  const res = await fetch(url, {
    headers: feedHeaders(new URL(url).origin),
    cache: "no-store",
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

/**
 * Choix de l'hôte via GetSportsZip (endpoint non verrouillé).
 * Renvoie l'hôte ET l'arbre pour ne pas le re-demander.
 */
export async function pickHostWithTree(
  getJson: Getter,
  hosts: readonly string[] = feedHosts(),
  deadline = Date.now() + 30_000,
): Promise<{ host: string; sports: SportNode[] } | null> {
  for (const host of hosts) {
    if (Date.now() > deadline) break;
    try {
      const json = await getJson(lineUrl(host, "GetSportsZip", { top: false }));
      const sports = parseSportsTree(json);
      if (sports.length) return { host, sports };
    } catch {
      /* next host */
    }
  }
  return null;
}

/** Compat : ancien sélecteur d'hôte. */
export async function pickHost(
  getJson: Getter,
  hosts: readonly string[] = feedHosts(),
  deadline = Date.now() + 30_000,
): Promise<string | null> {
  const found = await pickHostWithTree(getJson, hosts, deadline);
  return found?.host ?? null;
}

/** Ligues à scanner : GC > 0, sans les « Matchs alternatifs », football d'abord. */
export function leaguesFromTree(sports: SportNode[], maxLeagues = 45) {
  const order = (id?: number) => {
    const i = SPORT_IDS.indexOf(id ?? -1);
    return i === -1 ? SPORT_IDS.length : i;
  };
  const out: Array<{ li: number; name: string; sportId: number; sportName: string; gc: number }> = [];
  for (const sp of sports) {
    if (!sp || !Array.isArray(sp.L)) continue;
    const sportName = (sp.N ?? sp.E ?? `Sport ${sp.I ?? "?"}`).trim();
    for (const lg of sp.L) {
      if (!lg?.LI || !(lg.GC ?? 0)) continue;
      const name = (lg.L ?? "").trim();
      if (!name || /alternativ/i.test(name)) continue; // doublons « matchs alternatifs »
      out.push({ li: lg.LI, name, sportId: sp.I ?? 0, sportName, gc: lg.GC ?? 0 });
    }
  }
  out.sort((a, b) => {
    const fa = a.sportId === 1 ? 0 : 1;
    const fb = b.sportId === 1 ? 0 : 1;
    if (fa !== fb) return fa - fb;
    return b.gc - a.gc;
  });
  return out.slice(0, maxLeagues);
}

/**
 * Scan complet des paniers, sur les endpoints NON verrouillés du feed :
 *  1. GetSportsZip?top=false  → toutes les ligues qui jouent
 *  2. GetChampZip?champ=LI&top=false → les matchs pas encore commencés de chaque ligue
 *  3. GetGameZip?id           → TOUS les marchés du match → on garde la bande 1,007–1,01
 * Budget temps garanti : on renvoie toujours ce qu'on a récolté.
 */
export async function scrapeXbet(
  getJson: Getter,
  params: ScanParams = SCAN_DEFAULTS,
  onProgress: Progress = () => undefined,
  opts: { hosts?: readonly string[]; maxLeagues?: number; maxGames?: number; concurrency?: number; budgetMs?: number; days?: readonly string[] } = {},
): Promise<ScrapeResult> {
  const need = params.maxPaniers * params.maxLegs;
  const maxLeagues = opts.maxLeagues ?? 45;
  const maxGames = opts.maxGames ?? 140;
  const concurrency = opts.concurrency ?? 6;
  const deadline = Date.now() + (opts.budgetMs ?? 45_000);
  // Fenêtres des jours choisis (calendrier) : sans filtre on garde le comportement
  // historique (tout pré-match) ; avec un jour ou une plage on NE GARDE que ça.
  const windows = dayWindowsUtc(opts.days ?? []);

  const picked = await pickHostWithTree(getJson, opts.hosts ?? feedHosts(), deadline - 8_000);
  if (!picked) {
    return {
      ok: false,
      host: null,
      legs: [],
      events: 0,
      games: 0,
      error: "1xBet injoignable (1xbet.ci, 1xbet.com, linebet). Réessaie dans un instant.",
    };
  }
  const { host, sports } = picked;
  const leagues = leaguesFromTree(sports, maxLeagues);
  onProgress(`Connecté · ${new URL(host).hostname} · ${leagues.length} ligues actives`);

  /* 2. Matchs pré-match, ligue par ligue, dans le budget. */
  type Cand = { ev: EventZipLike; league: string; sport: string };
  const candidates: Cand[] = [];
  const seen = new Set<number>();
  const now = Date.now();
  let leaguesDone = 0;
  let leagueStop = false;

  await mapPool(leagues, Math.min(concurrency, 4), async (lg) => {
    if (leagueStop || Date.now() > deadline) {
      leagueStop = true;
      return;
    }
    try {
      const json = await getJson(lineUrl(host, "GetChampZip", { champ: lg.li, top: false }));
      const games = parseChampGames(json);
      leaguesDone += 1;
      for (const g of games) {
        if (!g?.I || seen.has(g.I)) continue;
        const home = (g.O1 ?? "").trim();
        const away = (g.O2 ?? "").trim();
        if (!home || !away) continue;
        if (/^(à domicile|home)$/i.test(home) || /^(à l['’]extérieur|away)$/i.test(away)) continue;
        const ko = eventKickoff(g as never);
        if (!ko) continue;
        if (windows.length && !inDayWindows(ko.getTime(), windows)) continue; // jour(s) choisi(s) seulement
        const ev = { ...g, L: g.L ?? g.LE ?? lg.name, SN: g.SN ?? g.SE ?? lg.sportName };
        if (!isPrematch(ev as never, params.bufferMin, now)) continue;
        seen.add(g.I);
        candidates.push({ ev, league: lg.name, sport: lg.sportName });
      }
      if (candidates.length >= need * 2) leagueStop = true;
    } catch {
      /* ligue indisponible — on continue */
    }
  });

  candidates.sort((a, b) => ((a.ev.S ?? 0) - (b.ev.S ?? 0)));
  onProgress(`${candidates.length} matchs pas encore commencés · lecture des marchés…`);
  if (!candidates.length) {
    return {
      ok: false,
      host,
      legs: [],
      events: 0,
      games: 0,
      error: windows.length
        ? `Aucun match pas encore commencé sur ${opts.days?.join(", ")}. Vérifie la date dans le calendrier.`
        : "Aucun match pas encore commencé pour l'instant. Réessaie plus tard.",
    };
  }

  /* 3. Tous les marchés de chaque match → cotes dans la bande. */
  const todo = candidates.slice(0, maxGames);
  const legs: XbetLeg[] = [];
  const have = new Set<number>();
  let games = 0;
  let gameStop = false;

  await mapPool(todo, concurrency, async (cand, i) => {
    if (gameStop || have.size >= need || Date.now() > deadline) {
      gameStop = true;
      return;
    }
    try {
      const json = await getJson(gameZipUrl(host, cand.ev.I));
      games += 1;
      const parsed = parseGame(json);
      if (parsed) {
        const game = { ...parsed, I: cand.ev.I, O1: parsed.O1 ?? cand.ev.O1, O2: parsed.O2 ?? cand.ev.O2, L: cand.league, SN: cand.sport, S: cand.ev.S };
        const got = legsFromEvent(game as never, host, params, now);
        if (got.length) {
          legs.push(...got);
          have.add(cand.ev.I);
        }
      }
      if (i % 10 === 0) onProgress(`Marchés ${Math.min(i + 1, todo.length)}/${todo.length} · ${have.size} matchs en bande`);
    } catch {
      games += 1;
    }
  });

  const pool = onePerMatch(legs).slice(0, need);
  return {
    ok: pool.length > 0,
    host,
    legs: pool,
    events: candidates.length,
    games,
    error: pool.length
      ? null
      : `Aucune cote entre ${params.oddMin} et ${params.oddMax} sur les matchs encore ouverts.`,
  };
}
