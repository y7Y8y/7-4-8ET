import { purgeStarted } from "./pack";
import { normalizeDays } from "./days";
import { SCAN_DEFAULTS, type ScanParams, type XbetState } from "./types";

const STATE_KEY = "ninety.xbet.state";
const PARAMS_KEY = "ninety.xbet.params";
const DAYS_KEY = "ninety.xbet.days";

/**
 * Les paniers d'AUTRES jours ne sont plus effacés : c'est la purge par coup
 * d'envoi (purgeStarted) qui décide — un panier commence → il saute.
 */
export function loadLocalState(): XbetState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STATE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as XbetState;
    return { ...parsed, paniers: purgeStarted(parsed.paniers ?? []) };
  } catch {
    return null;
  }
}

export function saveLocalState(state: XbetState) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STATE_KEY, JSON.stringify(state));
}

export function loadParams(): ScanParams {
  if (typeof window === "undefined") return SCAN_DEFAULTS;
  try {
    const raw = localStorage.getItem(PARAMS_KEY);
    if (!raw) return SCAN_DEFAULTS;
    return { ...SCAN_DEFAULTS, ...(JSON.parse(raw) as Partial<ScanParams>) };
  } catch {
    return SCAN_DEFAULTS;
  }
}

export function saveParams(p: ScanParams) {
  if (typeof window === "undefined") return;
  localStorage.setItem(PARAMS_KEY, JSON.stringify(p));
}

/** Jours choisis dans le calendrier (date simple ou plage). */
export function loadDays(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(DAYS_KEY);
    return raw ? normalizeDays(JSON.parse(raw)) : [];
  } catch {
    return [];
  }
}

export function saveDays(days: string[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(DAYS_KEY, JSON.stringify(days));
}
