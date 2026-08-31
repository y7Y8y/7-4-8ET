export const FEED_HOSTS = [
  "https://1xbet.ci",
  "https://www.1xbet.ci",
  "https://1xbet.com",
  "https://www.1xbet.com",
  "https://linebet.com",
] as const;

/** Linebet first: même moteur BetB2B, parfois accessible quand .ci/.com bloquent. */
export const CLIENT_HOSTS = [
  "https://linebet.com",
  "https://1xbet.ci",
  "https://www.1xbet.ci",
  "https://1xbet.com",
] as const;

/** Id 1xBet des sports qu'on scanne (1 = football, prioritaire). */
export const SPORT_IDS = [1, 3, 4, 2, 6, 5, 8, 10, 29, 12, 33, 36];

const UA =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36";

export const FEED_HEADERS: Record<string, string> = {
  accept: "application/json, text/plain, */*",
  "accept-language": "fr-FR,fr;q=0.9",
  "is-srv": "false",
  "x-app-n": "__BETTING_APP__",
  "x-svc-source": "__BETTING_APP__",
  "x-requested-with": "XMLHttpRequest",
  "user-agent": UA,
};

/** Headers par hôte (inoffensifs sur les endpoints ouverts, utiles ailleurs). */
export function feedHeaders(host: string): Record<string, string> {
  const origin = new URL(host).origin;
  return {
    ...FEED_HEADERS,
    origin,
    referer: `${origin}/line/`,
  };
}

/**
 * Paramètres stables du feed BetB2B — combo vérifié sur le VRAI 1xbet.ci
 * (GetSportsZip / GetChampZip / GetGameZip répondent 200 avec ces valeurs,
 * sans les en-têtes du service worker qui verrouillent Get1x2_VZip).
 */
export const FEED_QUERY_DEFAULTS: Record<string, string> = {
  lng: "fr",
  mode: "4",
  country: "94",
  partner: "5",
  gr: "650",
};

/** partner par skin (linebet d'après la doc famille BetB2B ; 1xbet = 5). */
const PARTNER_BY_HOST: Record<string, string> = {
  "https://linebet.com": "189",
};

export function lineUrl(
  host: string,
  path: string,
  q: Record<string, string | number | boolean>,
) {
  const u = new URL(`/service-api/LineFeed/${path}`, host);
  const base = { ...FEED_QUERY_DEFAULTS, partner: PARTNER_BY_HOST[new URL(host).origin] ?? FEED_QUERY_DEFAULTS.partner };
  for (const [k, v] of Object.entries({ ...base, ...q })) u.searchParams.set(k, String(v));
  return u.toString();
}

/**
 * Endpoints NON verrouillés du feed (pas d'en-tête x-dt du service worker) :
 * Get1x2_VZip / GetSportsShortZip → 406 côté serveur, on ne les utilise plus.
 */
export const FEED_PATHS = [
  "/service-api/LineFeed/GetSportsZip",
  "/service-api/LineFeed/GetChampZip",
  "/service-api/LineFeed/GetGameZip",
];

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
