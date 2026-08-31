import {
  BAND_LIMITS,
  DAY_WINDOWS,
  SCAN_DEFAULTS,
  STRICT_BAND,
  isDayWindow,
  type DayWindow,
  type ScanParams,
} from "./types";

/**
 * Source unique de vérité des paramètres de scan (serveur ET téléphone).
 *
 * Règle n°1 : la bande n'est JAMAIS élargie toute seule. On part de
 * 1,007–1,01 ; seule une valeur explicitement fournie par l'utilisateur
 * (Réglages → corps POST / query GET) peut la déplacer, et encore, dans les
 * garde-fous BAND_LIMITS. Aucun code de repli n'a le droit de toucher à ça.
 */
export function normalizeParams(input: Partial<ScanParams> | null | undefined): ScanParams {
  const src = { ...envDefaults(), ...strip(input) };
  const oddMin = clampBand(num(src.oddMin, SCAN_DEFAULTS.oddMin));
  const oddMax = clampBand(num(src.oddMax, SCAN_DEFAULTS.oddMax));
  const lo = Math.min(oddMin, oddMax);
  const hi = Math.max(oddMin, oddMax);
  return {
    oddMin: round4(lo),
    oddMax: round4(hi),
    bufferMin: Math.min(720, Math.max(0, Math.round(num(src.bufferMin, SCAN_DEFAULTS.bufferMin)))),
    maxLegs: Math.min(50, Math.max(1, Math.round(num(src.maxLegs, SCAN_DEFAULTS.maxLegs)))),
    maxPaniers: Math.min(8, Math.max(1, Math.round(num(src.maxPaniers, SCAN_DEFAULTS.maxPaniers)))),
    days: isDayWindow(src.days) ? src.days : SCAN_DEFAULTS.days,
  };
}

/** Paramètres depuis une query string : GET /api/xbet/scan?days=3d&oddMax=1.01 */
export function paramsFromQuery(q: URLSearchParams): ScanParams {
  const raw: Partial<ScanParams> = {};
  const set = (k: "oddMin" | "oddMax" | "bufferMin" | "maxLegs" | "maxPaniers") => {
    const v = q.get(k) ?? q.get(k.toLowerCase());
    if (v !== null && v.trim() !== "" && Number.isFinite(Number(v))) raw[k] = Number(v);
  };
  set("oddMin");
  set("oddMax");
  set("bufferMin");
  set("maxLegs");
  set("maxPaniers");
  const days = q.get("days") ?? q.get("window") ?? q.get("jours");
  if (isDayWindow(days)) raw.days = days;
  return normalizeParams(raw);
}

export type DayRange = { start: number; end: number; days: DayWindow; label: string };

/**
 * Fenêtre de jours du scan, bornée sur les jours UTC (= heure d'Abidjan,
 * fuseau de référence de l'app) :
 *  - today    : maintenant → fin de la journée
 *  - tomorrow : demain 00:00 → demain 24:00
 *  - 3d / 7d  : maintenant → fin du 3e / 7e jour
 *  - all      : maintenant → +∞ (tout ce que 1xBet propose en pré-match)
 */
export function dayRange(days: DayWindow, now = Date.now()): DayRange {
  const label = DAY_WINDOWS.find((w) => w.id === days)?.label ?? days;
  const d = new Date(now);
  const midnight = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  const DAY = 86_400_000;
  switch (days) {
    case "tomorrow":
      return { start: midnight + DAY, end: midnight + 2 * DAY, days, label };
    case "3d":
      return { start: now, end: midnight + 3 * DAY, days, label };
    case "7d":
      return { start: now, end: midnight + 7 * DAY, days, label };
    case "all":
      return { start: now, end: Number.POSITIVE_INFINITY, days, label };
    case "today":
    default:
      return { start: now, end: midnight + DAY, days: "today", label };
  }
}

export function inRange(kickoffMs: number, range: DayRange) {
  return kickoffMs >= range.start && kickoffMs < range.end;
}

/**
 * Valeurs par défaut du déploiement (.env) — elles remplacent SCAN_DEFAULTS
 * mais restent, elles aussi, sous les garde-fous. Côté navigateur, ces
 * variables n'existent pas : on retombe sur SCAN_DEFAULTS.
 */
function envDefaults(): Partial<ScanParams> {
  const e = typeof process === "undefined" ? undefined : process.env;
  if (!e) return {};
  const out: Partial<ScanParams> = {};
  const n = (v: string | undefined) => (v && Number.isFinite(Number(v)) ? Number(v) : undefined);
  const oddMin = n(e.XBET_ODD_MIN);
  const oddMax = n(e.XBET_ODD_MAX);
  const buffer = n(e.XBET_BUFFER_MIN);
  const legs = n(e.XBET_MAX_LEGS);
  const paniers = n(e.XBET_MAX_PANIERS);
  if (oddMin !== undefined) out.oddMin = oddMin;
  if (oddMax !== undefined) out.oddMax = oddMax;
  if (buffer !== undefined) out.bufferMin = buffer;
  if (legs !== undefined) out.maxLegs = legs;
  if (paniers !== undefined) out.maxPaniers = paniers;
  if (isDayWindow(e.XBET_DAYS)) out.days = e.XBET_DAYS;
  return out;
}

/** Les clés absentes/undefined ne doivent pas masquer les valeurs par défaut. */
function strip(input: Partial<ScanParams> | null | undefined): Partial<ScanParams> {
  const out: Partial<ScanParams> = {};
  if (!input) return out;
  for (const [k, v] of Object.entries(input)) {
    if (v !== undefined && v !== null) (out as Record<string, unknown>)[k] = v;
  }
  return out;
}

function clampBand(v: number) {
  if (!Number.isFinite(v)) return STRICT_BAND.oddMin;
  return Math.min(BAND_LIMITS.max, Math.max(BAND_LIMITS.min, v));
}

function round4(v: number) {
  return Math.round(v * 10_000) / 10_000;
}

function num(v: unknown, fallback: number) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}
