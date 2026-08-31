import { ymd } from "../format";
import { purgeStarted } from "./pack";
import { SCAN_DEFAULTS, type ScanParams, type XbetState } from "./types";

const STATE_KEY = "ninety.xbet.state";
const PARAMS_KEY = "ninety.xbet.params";

export function loadLocalState(): XbetState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STATE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as XbetState;
    const today = ymd();
    return {
      ...parsed,
      day: today,
      paniers: purgeStarted(parsed.day === today ? parsed.paniers ?? [] : []),
    };
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
