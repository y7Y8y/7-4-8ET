import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { ymd } from "../format";
import { purgeStarted } from "./pack";
import type { Panier, XbetState } from "./types";

const FILE = path.join(process.cwd(), "data", "paniers.json");

const empty = (): XbetState => ({
  day: ymd(),
  scannedAt: null,
  host: null,
  pool: 0,
  paniers: [],
  error: null,
});

export async function loadState(): Promise<XbetState> {
  try {
    const raw = await readFile(FILE, "utf8");
    const parsed = JSON.parse(raw) as XbetState;
    return { ...empty(), ...parsed, paniers: parsed.paniers ?? [] };
  } catch {
    return empty();
  }
}

export async function saveState(state: XbetState) {
  await mkdir(path.dirname(FILE), { recursive: true });
  await writeFile(FILE, JSON.stringify(state, null, 2), "utf8");
}

export async function liveState(): Promise<XbetState> {
  const state = await loadState();
  const today = ymd();
  const kept = purgeStarted(state.paniers);
  const next: XbetState = {
    ...state,
    day: today,
    paniers: kept,
    error: null,
  };
  if (kept.length !== state.paniers.length) await saveState(next);
  return next;
}

export async function writePaniers(partial: {
  host: string | null;
  pool: number;
  paniers: Panier[];
  error: string | null;
}) {
  const next: XbetState = {
    day: ymd(),
    scannedAt: new Date().toISOString(),
    host: partial.host,
    pool: partial.pool,
    paniers: purgeStarted(partial.paniers),
    error: partial.error,
  };
  await saveState(next);
  return next;
}

export async function dropPanier(id: string) {
  const state = await liveState();
  state.paniers = state.paniers.filter((p) => p.id !== id);
  await saveState(state);
  return state;
}
