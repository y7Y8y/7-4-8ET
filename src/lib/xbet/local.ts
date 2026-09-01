import { purgeStartedDetailed } from "./pack";
import { normalizeDays } from "./days";
import { normalizeParams } from "./params";
import { SCAN_DEFAULTS, type ScanParams, type XbetState } from "./types";

const STATE_KEY = "ninety.xbet.state";
const PARAMS_KEY = "ninety.xbet.params";
const DAYS_KEY = "ninety.xbet.days";

/**
 * Les paniers d'AUTRES jours ne sont plus effacés : c'est la purge au match
 * près (purgeStartedDetailed) qui décide — la jambe commencée saute, le reste
 * du panier reste jouable.
 */
export function loadLocalState(): XbetState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STATE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as XbetState;
    return { ...parsed, paniers: purgeStartedDetailed(parsed.paniers ?? []).paniers };
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
    return normalizeParams(JSON.parse(raw) as Partial<ScanParams>);
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
