import { BAND_LIMITS, DAY_WINDOWS, SCAN_DEFAULTS, STRICT_BAND, isDayWindow, type DayWindow, type ScanParams } from "./types";
import { addDays, ymd } from "../format";
import { expandRange, isValidDay, normalizeDays } from "./days";

/**
 * Source unique de vérité des paramètres de scan (serveur ET téléphone).
 *
 * Règle n°1 : la bande n'est JAMAIS élargie toute seule. On part de
 * 1,007–1,01 ; seule une valeur explicitement fournie par l'utilisateur
 * (Réglages → corps POST / query GET) peut la déplacer, et encore, dans les
 * garde-fous BAND_LIMITS. Aucun code de repli n'a le droit de toucher à ça.
 *
 * Modèle canonique des jours : une liste de dates ISO (`days: string[]`),
 * posée par le calendrier (1 clic = date, 2 clics = plage). En entrée, on
 * accepte aussi les préréglages « today | tomorrow | 3d | 7d | all ».
 */
export function normalizeParams(input: Record<string, unknown> | Partial<ScanParams> | null | undefined): ScanParams {
  const src = { ...envDefaults(), ...strip(input) } as Record<string, unknown>;
  const oddMin = clampBand(num(src.oddMin, SCAN_DEFAULTS.oddMin));
  const oddMax = clampBand(num(src.oddMax, SCAN_DEFAULTS.oddMax));
  const lo = Math.min(oddMin, oddMax);
  const hi = Math.max(oddMin, oddMax);
  return {
    oddMin: round4(lo),
    oddMax: round4(hi),
    minProduct: clampMinProduct(num(src.minProduct, SCAN_DEFAULTS.minProduct)),
    bufferMin: Math.min(720, Math.max(0, Math.round(num(src.bufferMin, SCAN_DEFAULTS.bufferMin)))),
    maxLegs: Math.min(50, Math.max(1, Math.round(num(src.maxLegs, SCAN_DEFAULTS.maxLegs)))),
    maxPaniers: Math.min(8, Math.max(1, Math.round(num(src.maxPaniers, SCAN_DEFAULTS.maxPaniers)))),
    days: daysFromInput(src.days),
  };
}

/** Paramètres depuis une query string : GET /api/xbet/scan?days=3d&oddMax=1.01 */
export function paramsFromQuery(q: URLSearchParams): ScanParams {
  const raw: Record<string, unknown> = {};
  const set = (k: "oddMin" | "oddMax" | "minProduct" | "bufferMin" | "maxLegs" | "maxPaniers") => {
    const v = q.get(k) ?? q.get(k.toLowerCase());
    if (v !== null && v.trim() !== "" && Number.isFinite(Number(v))) raw[k] = Number(v);
  };
  set("oddMin");
  set("oddMax");
  set("minProduct");
  set("bufferMin");
  set("maxLegs");
  set("maxPaniers");
  const days = q.get("days") ?? q.get("window") ?? q.get("jours");
  if (days !== null) raw.days = days;
  return normalizeParams(raw as Partial<ScanParams>);
}

/**
 * Jours en entrée → liste canonique ISO :
 *  - "today" / "tomorrow" / "3d" / "7d" → la plage correspondante ;
 *  - "all" (ou liste vide explicite) → [] = tout le pré-match, sans filtre ;
 *  - "2026-09-02,2026-09-04" ou ["2026-09-02", …] → les dates données ;
 *  - absent → aujourd'hui (comportement par défaut de l'app).
 */
export function daysFromInput(input: unknown): string[] {
  if (input === undefined || input === null || input === "") return defaultDays();
  if (isDayWindow(input)) return presetToDays(input);
  if (typeof input === "string") {
    const parts = input.split(",").map((s) => s.trim()).filter(Boolean);
    if (parts.length === 1 && isDayWindow(parts[0])) return presetToDays(parts[0]);
    const dates = normalizeDays(parts);
    return dates.length ? dates : defaultDays();
  }
  if (Array.isArray(input)) {
    const dates = normalizeDays(input);
    return dates.length ? dates : defaultDays();
  }
  return defaultDays();
}

/** Préréglage → dates ISO. « all » → [] (pas de filtre). */
export function presetToDays(id: DayWindow, today = ymd()): string[] {
  switch (id) {
    case "today":
      return [today];
    case "tomorrow":
      return [addDays(today, 1)];
    case "3d":
      return expandRange(today, addDays(today, 2));
    case "7d":
      return expandRange(today, addDays(today, 6));
    case "all":
      return [];
    default:
      return defaultDays();
  }
}

function defaultDays() {
  return [ymd()];
}

export { DAY_WINDOWS };

export type DayRange = { start: number; end: number; days: string[]; label: string };

/** Description lisible de la fenêtre appliquée (écho dans les réponses API). */
export function describeDays(days: readonly string[], now = Date.now()): DayRange {
  const ds = normalizeDays(days);
  if (!ds.length) {
    return { start: now, end: Number.POSITIVE_INFINITY, days: [], label: "Tout le pré-match" };
  }
  const start = Date.parse(`${ds[0]}T00:00:00.000Z`);
  const end = Date.parse(`${ds[ds.length - 1]}T00:00:00.000Z`) + 86_400_000;
  const label = DAY_WINDOWS.some((w) => presetToDays(w.id).join(",") === ds.join(","))
    ? (DAY_WINDOWS.find((w) => presetToDays(w.id).join(",") === ds.join(","))?.label ?? "")
    : ds.length === 1
      ? ds[0]
      : `${ds[0]} → ${ds[ds.length - 1]}`;
  return { start, end, days: ds, label };
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
  const minProduct = n(e.XBET_MIN_PRODUCT);
  const buffer = n(e.XBET_BUFFER_MIN);
  const legs = n(e.XBET_MAX_LEGS);
  const paniers = n(e.XBET_MAX_PANIERS);
  if (oddMin !== undefined) out.oddMin = oddMin;
  if (oddMax !== undefined) out.oddMax = oddMax;
  if (minProduct !== undefined) out.minProduct = minProduct;
  if (buffer !== undefined) out.bufferMin = buffer;
  if (legs !== undefined) out.maxLegs = legs;
  if (paniers !== undefined) out.maxPaniers = paniers;
  if (e.XBET_DAYS) out.days = daysFromInput(e.XBET_DAYS);
  return out;
}

/** Les clés absentes/undefined ne doivent pas masquer les valeurs par défaut. */
function strip(input: Record<string, unknown> | Partial<ScanParams> | null | undefined): Partial<ScanParams> {
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

function clampMinProduct(v: number) {
  if (!Number.isFinite(v)) return SCAN_DEFAULTS.minProduct;
  return Math.min(1000, Math.max(1.0001, v));
}

function round4(v: number) {
  return Math.round(v * 10_000) / 10_000;
}

function num(v: unknown, fallback: number) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

/** Utilisé par les tests de cohérence : une date ISO valide ? */
export { isValidDay };
