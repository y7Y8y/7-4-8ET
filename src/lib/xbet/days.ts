import { addDays, ymd } from "../format";

/** Plafond de jours par scan (protège le budget temps du scrape). */
export const MAX_DAYS = 14;

export function isValidDay(day: unknown): day is string {
  return (
    typeof day === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(day) &&
    Number.isFinite(Date.parse(`${day}T00:00:00.000Z`))
  );
}

/** Liste propre : jours valides, uniques, triés, plafonnés à MAX_DAYS. */
export function normalizeDays(input: unknown): string[] {
  const arr = Array.isArray(input) ? input : isValidDay(input) ? [input] : [];
  return [...new Set(arr.filter(isValidDay))].sort().slice(0, MAX_DAYS);
}

/** Plage inclusive → liste de jours (le « deuxième clic » du calendrier). */
export function expandRange(start: string, end: string): string[] {
  const [a, b] = start <= end ? [start, end] : [end, start];
  const out: string[] = [];
  for (let d = a; isValidDay(d) && d <= b && out.length < MAX_DAYS; d = addDays(d, 1)) {
    out.push(d);
  }
  return out;
}

/** Fenêtres [début, fin) en ms (UTC) — filtre serveur des candidats par jour. */
export function dayWindowsUtc(days: readonly string[]): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  for (const d of days) {
    const start = Date.parse(`${d}T00:00:00.000Z`);
    if (Number.isFinite(start)) out.push([start, start + 24 * 3600_000]);
  }
  return out.sort((a, b) => a[0] - b[0]);
}

export function inDayWindows(t: number, windows: Array<[number, number]>) {
  return windows.some(([s, e]) => t >= s && t < e);
}

/** Clé compacte pour ids/stockage : « 2026-09-02 » ou « 2026-09-02..2026-09-04 ». */
export function daysKey(days: readonly string[], fallback = ymd()) {
  const ds = normalizeDays(days);
  if (!ds.length) return fallback;
  return ds.length === 1 ? ds[0] : `${ds[0]}..${ds[ds.length - 1]}`;
}

function short(day: string) {
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(new Date(`${day}T12:00:00Z`));
}

/** Libellé humain : « aujourd’hui », « mer. 3 sept. », « mer. 3 → ven. 5 sept. ». */
export function daysLabel(days: readonly string[]): string {
  const ds = normalizeDays(days);
  const today = ymd();
  if (!ds.length) return "aujourd’hui";
  if (ds.length === 1) return ds[0] === today ? "aujourd’hui" : short(ds[0]);
  return `${short(ds[0])} → ${short(ds[ds.length - 1])}`;
}

/** Relabel à partir de la clé stockée dans l'état (state.day). */
export function keyLabel(key: string | null | undefined): string {
  if (!key) return "aujourd’hui";
  return daysLabel(key.split("..").filter(isValidDay));
}
