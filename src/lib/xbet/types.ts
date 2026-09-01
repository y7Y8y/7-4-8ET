export type XbetLeg = {
  id: string;
  eventId: number;
  sport: string;
  league: string;
  home: string;
  away: string;
  kickoff: string;
  market: string;
  pick: string;
  odd: number;
  host: string;
};

export type Panier = {
  id: string;
  day: string;
  createdAt: string;
  product: number;
  legs: XbetLeg[];
};

export type XbetState = {
  day: string;
  /** Jours (ISO) couverts par le dernier scan — date ou plage du calendrier. */
  days?: string[];
  scannedAt: string | null;
  host: string | null;
  pool: number;
  paniers: Panier[];
  error: string | null;
};

/**
 * Préréglages de fenêtre acceptés EN ENTRÉE (API/query/env) comme sucre de
 * syntaxe : « today », « tomorrow », « 3d », « 7d », « all ». Le modèle
 * canonique reste une liste de dates ISO (`days: string[]`) — c'est ce que
 * pose le calendrier de l'app (1 clic = date, 2 clics = plage).
 */
export type DayWindow = "today" | "tomorrow" | "3d" | "7d" | "all";

export const DAY_WINDOWS: Array<{ id: DayWindow; label: string; short: string }> = [
  { id: "today", label: "Aujourd'hui", short: "Auj." },
  { id: "tomorrow", label: "Demain", short: "Dem." },
  { id: "3d", label: "3 jours", short: "3 j" },
  { id: "7d", label: "7 jours", short: "7 j" },
  { id: "all", label: "Tous", short: "Tous" },
];

export function isDayWindow(v: unknown): v is DayWindow {
  return typeof v === "string" && DAY_WINDOWS.some((w) => w.id === v);
}

/**
 * Bande STRICTE de l'app : 1,007 – 1,01. Elle n'est jamais élargie
 * automatiquement (jamais de repli « on prend 1,02 parce qu'il manque des
 * matchs ») — seuls les Réglages de l'utilisateur peuvent la déplacer.
 */
export const STRICT_BAND = { oddMin: 1.007, oddMax: 1.01 } as const;

/** Garde-fous des Réglages : au-delà, ce n'est plus l'esprit « 1,01 ». */
export const BAND_LIMITS = { min: 1.001, max: 1.2 } as const;

export type ScanParams = {
  oddMin: number;
  oddMax: number;
  /** Cote totale minimale visée par CHAQUE panier (un panier sous la cible = inutile). */
  minProduct: number;
  bufferMin: number;
  maxLegs: number;
  maxPaniers: number;
  /** Jours (ISO YYYY-MM-DD) à scanner — vide = tout le pré-match (« all »). */
  days: string[];
};

export const SCAN_DEFAULTS: ScanParams = {
  oddMin: STRICT_BAND.oddMin,
  oddMax: STRICT_BAND.oddMax,
  minProduct: 1.5,
  bufferMin: 20,
  maxLegs: 50,
  maxPaniers: 5,
  days: [],
};

export function isStrictBand(p: { oddMin: number; oddMax: number }) {
  return (
    Math.abs(p.oddMin - STRICT_BAND.oddMin) < 1e-9 && Math.abs(p.oddMax - STRICT_BAND.oddMax) < 1e-9
  );
}
