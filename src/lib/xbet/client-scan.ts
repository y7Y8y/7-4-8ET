import { CLIENT_HOSTS, CORS_PROXIES, FEED_HEADERS, FEED_HOSTS } from "./hosts";
import { scrapeXbet, type Progress } from "./scrape";
import { SCAN_DEFAULTS, type ScanParams, type XbetLeg } from "./types";

async function readJson(res: Response) {
  const text = await res.text();
  const trimmed = text.trim();
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) {
    throw new Error("réponse non JSON");
  }
  return JSON.parse(trimmed) as unknown;
}

export async function browserGet(url: string): Promise<unknown> {
  const signal = AbortSignal.timeout(10000);
  try {
    const res = await fetch(url, { headers: FEED_HEADERS, cache: "no-store", signal });
    if (res.ok) return readJson(res);
  } catch {
    /* CORS / réseau */
  }
  let last = "proxy";
  for (const wrap of CORS_PROXIES) {
    try {
      const res = await fetch(wrap(url), { cache: "no-store", signal: AbortSignal.timeout(10000) });
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
  params: ScanParams = SCAN_DEFAULTS,
  onProgress: Progress = () => undefined,
): Promise<{
  ok: boolean;
  host: string | null;
  legs: XbetLeg[];
  events: number;
  games: number;
  error: string | null;
}> {
  return scrapeXbet(browserGet, params, onProgress, {
    host: undefined,
    maxGames: 90,
    concurrency: 4,
  });
}

export { FEED_HOSTS };
