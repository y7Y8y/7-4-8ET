import { mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { DayLine } from "./day-types";

/** Fraîcheur : une ligne de moins de 3 min est servie telle quelle. */
export const DAY_TTL_MS = 3 * 60 * 1000;

let mem: Map<string, DayLine> = new Map();

function files(day: string): string[] {
  const base = process.env.XBET_DATA_DIR ?? path.join(process.cwd(), "data");
  return [
    path.join(base, `xbet-day-${day}.json`),
    path.join(os.tmpdir(), `ninety-day-${day}.json`),
  ];
}

/**
 * Garde-fou : un appel FS peut ne jamais revenir (FS gelé, procfs…).
 * On borne lecture et écriture dans le temps.
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

function valid(day: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(day);
}

export async function loadDay(day: string): Promise<DayLine | null> {
  if (!valid(day)) return null;
  const cached = mem.get(day);
  if (cached) return cached;
  for (const file of files(day)) {
    const raw = await withTimeout(readFile(file, "utf8"), 2_000);
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw) as DayLine;
      if (parsed && parsed.day === day) {
        mem.set(day, parsed);
        return parsed;
      }
    } catch {
      /* fichier corrompu — candidat suivant */
    }
  }
  return null;
}

export async function saveDay(line: DayLine): Promise<boolean> {
  if (!valid(line.day) || !line.stats?.matches) return false;
  mem.set(line.day, line);
  const json = JSON.stringify(line);
  for (const file of files(line.day)) {
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
  return false; // garde en mémoire quand même
}

export function isFresh(line: DayLine | null, ttl = DAY_TTL_MS): boolean {
  if (!line) return false;
  const t = Date.parse(line.generatedAt);
  return Number.isFinite(t) && Date.now() - t < ttl && line.stats.matches > 0;
}

/** Retrouve un match par id dans les jours proches (aujourd'hui, ±1 jour). */
export async function findMatch(
  id: number,
  day?: string,
): Promise<{ match: DayLine["leagues"][number]["matches"][number]; line: DayLine } | null> {
  const days = day ? [day] : nearbyDays();
  for (const d of days) {
    const line = await loadDay(d);
    if (!line) continue;
    for (const lg of line.leagues) {
      const match = lg.matches.find((m) => m.id === id);
      if (match) return { match, line };
    }
  }
  return null;
}

function nearbyDays(): string[] {
  const today = new Date();
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return [fmt(today), fmt(new Date(+today + 86_400_000)), fmt(new Date(+today - 86_400_000))];
}
