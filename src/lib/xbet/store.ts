import { mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { ymd } from "../format";
import { daysKey, normalizeDays } from "./days";
import { purgeStarted } from "./pack";
import type { Panier, XbetState } from "./types";

/**
 * Sur Vercel le système de fichiers du déploiement est en lecture seule :
 * on tente data/, puis /tmp, et en dernier recours on garde l'état en mémoire
 * (le téléphone garde déjà sa copie dans localStorage, qui prime côté client).
 */
function stateFile(): string {
  const dir = process.env.XBET_DATA_DIR ?? path.join(process.cwd(), "data");
  return path.join(dir, "paniers.json");
}

let memState: XbetState | null = null;

/**
 * Garde-fou : un appel FS peut ne jamais revenir (NFS/procfs/FS gelé).
 * On borne lecture et écriture dans le temps au lieu d'attendre indéfiniment.
 */
function withTimeout<T>(p: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([
    p.then(
      (v) => v,
      () => null,
    ),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), ms)),
  ]);
}

const empty = (): XbetState => ({
  day: ymd(),
  scannedAt: null,
  host: null,
  pool: 0,
  paniers: [],
  error: null,
});

export async function loadState(): Promise<XbetState> {
  const candidates = [stateFile(), path.join(os.tmpdir(), "ninety-paniers.json")];
  for (const file of candidates) {
    const raw = await withTimeout(readFile(file, "utf8"), 2_000);
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw) as XbetState;
      memState = { ...empty(), ...parsed, paniers: parsed.paniers ?? [] };
      return memState;
    } catch {
      /* fichier corrompu — candidate suivant */
    }
  }
  return memState ?? empty();
}

async function persist(state: XbetState): Promise<boolean> {
  const json = JSON.stringify(state, null, 2);
  const candidates = [stateFile(), path.join(os.tmpdir(), "ninety-paniers.json")];
  for (const file of candidates) {
    const ok = await withTimeout(
      (async () => {
        await mkdir(path.dirname(file), { recursive: true });
        await writeFile(file, json, "utf8");
        return true;
      })(),
      4_000,
    );
    if (ok) return true;
  }
  /* aucun support dispo : l'état reste en mémoire pour cette instance */
  return false;
}

export async function saveState(state: XbetState) {
  memState = state;
  await persist(state);
}

export async function liveState(): Promise<XbetState> {
  const state = await loadState();
  const today = ymd();
  const kept = purgeStarted(state.paniers);
  const next: XbetState = {
    ...state,
    day: state.day || today,
    paniers: kept,
    error: null,
  };
  if (kept.length !== state.paniers.length) await saveState(next);
  return next;
}

export async function writePaniers(partial: {
  days?: string[];
  host: string | null;
  pool: number;
  paniers: Panier[];
  error: string | null;
}) {
  const days = normalizeDays(partial.days ?? []);
  const next: XbetState = {
    day: daysKey(days),
    days,
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
