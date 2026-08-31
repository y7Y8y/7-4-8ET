export const FEED_HOSTS = [
  "https://1xbet.ci",
  "https://www.1xbet.ci",
  "https://1xbet.com",
  "https://www.1xbet.com",
  "https://linebet.com",
] as const;

/** Linebet first: same BetB2B engine, reachable via proxy quand .ci/.com bloquent. */
export const CLIENT_HOSTS = [
  "https://linebet.com",
  "https://1xbet.ci",
  "https://www.1xbet.ci",
  "https://1xbet.com",
] as const;

export const SPORT_IDS = [1, 3, 4, 2, 6, 5, 8, 10, 29, 12, 33, 36];

const UA =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36";

/** Base commune — complétée par feedHeaders(host) avec Origin/Referer. */
export const FEED_HEADERS: Record<string, string> = {
  accept: "application/json, text/plain, */*",
  "accept-language": "fr-FR,fr;q=0.9",
  "is-srv": "false",
  "x-app-n": "__BETTING_APP__",
  "x-svc-source": "__BETTING_APP__",
  "x-requested-with": "XMLHttpRequest",
  "user-agent": UA,
};

/**
 * Headers par hôte. Le moteur BetB2B répond 406 NotAcceptable si Origin/Referer
 * ne correspondent pas au skin interrogé — il faut les envoyer à chaque requête.
 */
export function feedHeaders(host: string): Record<string, string> {
  const origin = new URL(host).origin;
  return {
    ...FEED_HEADERS,
    origin,
    referer: `${origin}/line/`,
  };
}

export function lineUrl(host: string, path: string, q: Record<string, string | number | boolean>) {
  const u = new URL(`/service-api/LineFeed/${path}`, host);
  for (const [k, v] of Object.entries(q)) u.searchParams.set(k, String(v));
  return u.toString();
}

/** Le feed autorise uniquement ces chemins — le proxy /api/xbet/feed les vérifie. */
export const FEED_PATHS = ["/service-api/LineFeed/Get1x2_VZip", "/service-api/LineFeed/GetGameZip"];

/** Override (tests, miroirs) : XBET_FEED_HOSTS="https://host1,https://host2". */
export function feedHosts(): string[] {
  const raw = process.env.XBET_FEED_HOSTS;
  if (!raw) return [...FEED_HOSTS];
  return raw
    .split(",")
    .map((h) => h.trim())
    .filter(Boolean);
}

export const CORS_PROXIES = [
  (url: string) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
  (url: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
  (url: string) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
] as const;
