import { marketLabel, pickLabel } from "./markets";
import type { ScanParams, XbetLeg } from "./types";

type Coeff = { T: number; C: number; P?: number; CV?: string };
export type EventZip = {
  I: number;
  O1?: string;
  O2?: string;
  L?: string;
  SN?: string;
  SE?: string;
  S?: number;
  SS?: number;
  SC?: unknown;
  E?: Coeff[];
  AE?: Array<{ ME?: Coeff[] }>;
};

function inBand(c: number, min: number, max: number) {
  return c + 1e-9 >= min && c - 1e-9 <= max;
}

function walkCoeffs(node: unknown, out: Coeff[]) {
  if (!node || typeof node !== "object") return;
  const n = node as Record<string, unknown>;
  if (typeof n.C === "number" && typeof n.T === "number" && n.T !== 1000 && n.C >= 1 && n.C < 3) {
    out.push(n as unknown as Coeff);
  }
  if (Array.isArray(node)) {
    for (const x of node) walkCoeffs(x, out);
    return;
  }
  for (const v of Object.values(n)) walkCoeffs(v, out);
}

export function eventKickoff(ev: EventZip) {
  if (!ev.S) return null;
  const ms = ev.S > 10_000_000_000 ? ev.S : ev.S * 1000;
  return new Date(ms);
}

export function isPrematch(ev: EventZip, bufferMin: number, now = Date.now()) {
  const ko = eventKickoff(ev);
  if (!ko) return false;
  if (ko.getTime() - now < bufferMin * 60_000) return false;
  if (ev.SC && typeof ev.SC === "object" && ev.SC !== null && "CP" in (ev.SC as object)) return false;
  return true;
}

export function legsFromEvent(ev: EventZip, host: string, p: ScanParams, now = Date.now()): XbetLeg[] {
  if (!isPrematch(ev, p.bufferMin, now)) return [];
  const home = (ev.O1 ?? "").trim();
  const away = (ev.O2 ?? "").trim();
  const ko = eventKickoff(ev);
  if (!home || !away || !ko) return [];
  const coeffs: Coeff[] = [];
  walkCoeffs(ev, coeffs);
  const seen = new Set<string>();
  const legs: XbetLeg[] = [];
  for (const c of coeffs) {
    const odd = Number(c.CV ?? c.C);
    if (!inBand(odd, p.oddMin, p.oddMax)) continue;
    const key = `${ev.I}-${c.T}-${c.P ?? "x"}-${odd}`;
    if (seen.has(key)) continue;
    seen.add(key);
    legs.push({
      id: key,
      eventId: ev.I,
      sport: (ev.SE ?? ev.SN ?? "Sport").trim(),
      league: ev.L ?? "",
      home,
      away,
      kickoff: ko.toISOString(),
      market: marketLabel(c.T, c.P),
      pick: pickLabel(c.T, home, away, c.P),
      odd,
      host,
    });
  }
  return legs;
}

export function onePerMatch(legs: XbetLeg[]) {
  const best = new Map<number, XbetLeg>();
  for (const l of legs) {
    const prev = best.get(l.eventId);
    if (!prev || Math.abs(l.odd - 1.01) < Math.abs(prev.odd - 1.01)) best.set(l.eventId, l);
  }
  return [...best.values()].sort((a, b) => +new Date(a.kickoff) - +new Date(b.kickoff));
}

export function parseEventList(json: unknown): EventZip[] {
  if (!json || typeof json !== "object") return [];
  const v = (json as { Value?: unknown }).Value;
  return Array.isArray(v) ? (v as EventZip[]) : [];
}

export function parseGame(json: unknown): EventZip | null {
  if (!json || typeof json !== "object") return null;
  const v = (json as { Value?: unknown }).Value;
  if (!v || typeof v !== "object") return null;
  return v as EventZip;
}
