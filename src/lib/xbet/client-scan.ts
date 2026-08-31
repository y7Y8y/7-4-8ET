import { CLIENT_HOSTS, CORS_PROXIES, FEED_HEADERS, feedHeaders } from "./hosts";
import { normalizeParams } from "./params";
import { scrapeXbet, type Getter, type Progress, type ScrapeResult } from "./scrape";
import { SCAN_DEFAULTS, type ScanParams } from "./types";

async function readJson(res: Response) {
  const text = await res.text();
  const trimmed = text.trim();
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) {
    throw new Error("réponse non JSON");
  }
  return JSON.parse(trimmed) as unknown;
}

/**
 * Depuis le navigateur, dans l'ordre :
 *  1. fetch direct (passe si 1xBet envoie les headers CORS)
 *  2. NOTRE proxy same-origin /api/xbet/feed (le serveur sort vers 1xBet)
 *  3. proxys CORS publics — dernier recours, souvent morts
 */
export async function browserGet(url: string): Promise<unknown> {
  // 1. direct
  try {
    const res = await fetch(url, {
      headers: feedHeaders(new URL(url).origin),
      cache: "no-store",
      signal: AbortSignal.timeout(9000),
    });
    if (res.ok) return await readJson(res);
  } catch {
    /* CORS / réseau */
  }

  // 2. proxy same-origin
  try {
    const res = await fetch(`/api/xbet/feed?url=${encodeURIComponent(url)}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(14_000),
    });
    if (res.ok) return await readJson(res);
  } catch {
    /* serveur indisponible */
  }

  // 3. proxys publics
  let last = "proxy";
  for (const wrap of CORS_PROXIES) {
    try {
      const res = await fetch(wrap(url), {
        headers: { accept: FEED_HEADERS.accept },
        cache: "no-store",
        signal: AbortSignal.timeout(9000),
      });
      if (!res.ok) {
        last = `proxy ${res.status}`;
        continue;
      }
      return readJson(res);
    } catch (err) {
      last = err instanceof Error ? err.message : "proxy";
    }
  }
  throw new Error(last);
}

export async function clientScrape(
  rawParams: ScanParams = SCAN_DEFAULTS,
  onProgress: Progress = () => undefined,
): Promise<ScrapeResult> {
  const params = normalizeParams(rawParams);
  // Budget global côté téléphone : au-delà, chaque getter échoue immédiatement
  // pour finir proprement au lieu de faire attendre l'utilisateur des minutes.
  const deadline = Date.now() + 60_000;
  const budgeted: Getter = (url) => {
    if (Date.now() > deadline) return Promise.reject(new Error("téléphone : budget dépassé"));
    return browserGet(url);
  };
  return scrapeXbet(budgeted, params, onProgress, {
    hosts: CLIENT_HOSTS,
    maxGames: params.days === "today" || params.days === "tomorrow" ? 90 : 160,
    concurrency: 4,
    budgetMs: 60_000,
  });
}
