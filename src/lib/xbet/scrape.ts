import { FEED_HEADERS, FEED_HOSTS, SPORT_IDS, lineUrl } from "./hosts";
import { isPrematch, legsFromEvent, onePerMatch, parseEventList, parseGame } from "./parse";
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
    headers: FEED_HEADERS,
    cache: "no-store",
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function pickHost(getJson: Getter, hosts: readonly string[] = FEED_HOSTS): Promise<string | null> {
  for (const host of hosts) {
    try {
      const json = await getJson(
        lineUrl(host, "Get1x2_VZip", { sports: 1, count: 3, lng: "fr", mode: 4 }),
      );
      const list = parseEventList(json);
      if (list.length) return host;
    } catch {
      /* next host */
    }
  }
  return null;
}

export async function scrapeXbet(
  getJson: Getter,
  params: ScanParams = SCAN_DEFAULTS,
  onProgress: Progress = () => undefined,
  opts: { host?: string; hosts?: readonly string[]; maxGames?: number; concurrency?: number } = {},
): Promise<ScrapeResult> {
  const need = params.maxPaniers * params.maxLegs;
  const maxGames = opts.maxGames ?? 140;
  const concurrency = opts.concurrency ?? 6;
  const host = opts.host ?? (await pickHost(getJson, opts.hosts ?? FEED_HOSTS));
  if (!host) {
    return {
      ok: false,
      host: null,
      legs: [],
      events: 0,
      games: 0,
      error: "1xBet injoignable (1xbet.ci, 1xbet.com, linebet). Réessaie depuis le téléphone.",
    };
  }

  onProgress(`Connecté · ${new URL(host).hostname}`);
  const rawEvents: ReturnType<typeof parseEventList> = [];
  for (const si of SPORT_IDS) {
    try {
      onProgress(`Liste ${sportName(si)}…`);
      const json = await getJson(
        lineUrl(host, "Get1x2_VZip", { sports: si, count: 80, lng: "fr", mode: 4 }),
      );
      rawEvents.push(...parseEventList(json));
    } catch {
      /* sport missing on this skin */
    }
  }

  const now = Date.now();
  const seen = new Set<number>();
  const events = rawEvents.filter((ev) => {
    if (!ev.I || seen.has(ev.I)) return false;
    seen.add(ev.I);
    return Boolean(ev.O1 && ev.O2) && isPrematch(ev, params.bufferMin, now);
  });

  const fromList: XbetLeg[] = [];
  for (const ev of events) fromList.push(...legsFromEvent(ev, host, params, now));
  const extra: XbetLeg[] = [];
  onProgress(`${events.length} matchs pré-match · ${onePerMatch(fromList).length} déjà en bande`);

  const have = new Set(fromList.map((l) => l.eventId));
  const todo = events.filter((e) => !have.has(e.I)).slice(0, maxGames);
  let games = 0;

  await mapPool(todo, concurrency, async (ev, i) => {
    if (onePerMatch([...fromList, ...extra]).length >= need) return;
    try {
      const json = await getJson(
        lineUrl(host, "GetGameZip", {
          id: ev.I,
          lng: "fr",
          isSubGames: true,
          GroupEvents: true,
        }),
      );
      games += 1;
      const parsed = parseGame(json);
      const game = {
        ...ev,
        ...(parsed ?? {}),
        I: ev.I,
        O1: parsed?.O1 ?? ev.O1,
        O2: parsed?.O2 ?? ev.O2,
        L: parsed?.L ?? ev.L,
        S: parsed?.S ?? ev.S,
        SE: parsed?.SE ?? parsed?.SN ?? ev.SE ?? ev.SN,
      };
      extra.push(...legsFromEvent(game, host, params, now));
      if (i % 8 === 0) {
        onProgress(
          `Marchés ${Math.min(i + 1, todo.length)}/${todo.length} · ${onePerMatch([...fromList, ...extra]).length} cotes 1,01`,
        );
      }
    } catch {
      games += 1;
    }
  });

  const pool = onePerMatch([...fromList, ...extra]).slice(0, need);
  return {
    ok: pool.length > 0,
    host,
    legs: pool,
    events: events.length,
    games,
    error: pool.length
      ? null
      : "Aucune cote entre 1,007 et 1,01 sur les matchs encore ouverts.",
  };
}

function sportName(si: number) {
  const names: Record<number, string> = {
    1: "football",
    2: "hockey",
    3: "basket",
    4: "tennis",
    5: "baseball",
    6: "volley",
    8: "handball",
    10: "tennis de table",
    12: "football US",
    29: "futsal",
    33: "cricket",
    36: "esport",
  };
  return names[si] ?? `sport ${si}`;
}
