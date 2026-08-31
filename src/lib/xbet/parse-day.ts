import { pickLabel } from "./markets";
import type { EventZip } from "./parse";
import { eventKickoff } from "./parse";
import type { DayMarket, DaySelection } from "./day-types";

type RawCoeff = { T?: unknown; C?: unknown; CV?: unknown; P?: unknown; N?: unknown };

/** Nombre depuis un number OU une string ("1.085") — le feed utilise les deux (C, CV). */
const num = (v: unknown): number | null => {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
};

/**
 * Sélection valide : T connu (nombre), cote ≥ 1 lisible (C ou CV).
 * Le nom vient du feed (N) sinon de notre table (pickLabel) sinon "Choix T".
 */
function toSelection(raw: RawCoeff, home: string, away: string): DaySelection | null {
  const code = num(raw.T);
  if (code === null) return null;
  const odd = num(num(raw.CV) ?? num(raw.C));
  if (odd === null || odd < 1) return null;
  const param = num(raw.P) ?? undefined;
  const name =
    typeof raw.N === "string" && raw.N.trim()
      ? raw.N.trim()
      : pickLabel(code, home, away, param) || `Choix ${code}`;
  return { code, name, odd, ...(param !== undefined ? { param } : {}) };
}

function isMainResult(selections: DaySelection[]) {
  return selections.some((s) => s.code === 1 || s.code === 2 || s.code === 3);
}

/** Marchés de base depuis la liste (E du Get1x2_VZip) — dispo sans GetGameZip. */
export function baseMarkets(ev: EventZip): DayMarket[] {
  const home = (ev.O1 ?? "").trim();
  const away = (ev.O2 ?? "").trim();
  if (!Array.isArray(ev.E) || !ev.E.length) return [];
  const selections = ev.E.map((c) => toSelection(c as unknown as RawCoeff, home, away))
    .filter((s): s is DaySelection => s !== null)
    .sort((a, b) => a.code - b.code);
  if (!selections.length) return [];
  return [{ name: "Résultat du match", selections }];
}

/** Un nœud est un groupe de marchés s'il porte un nom (G) et des cotes (E). */
function looksLikeGroup(node: Record<string, unknown>) {
  return typeof node.G === "string" && node.G.trim() !== "" && Array.isArray(node.E);
}

/** E à la racine du zip = marché principal (1/N/2). */
function isMainResultRoot(node: Record<string, unknown>) {
  const sels = (Array.isArray(node.E) ? node.E : []).map((c) =>
    toSelection((c ?? {}) as RawCoeff, "", ""),
  );
  return sels.some((s) => s && (s.code === 1 || s.code === 2 || s.code === 3));
}

/**
 * Extraction tolérante de TOUS les marchés d'un GetGameZip.
 * Parcours récursif : accepte GE/E/ME, groupes nommés (G) ou imbriqués,
 * codes de marchés inconnus (fallback "Marché T"), cotes en CV string.
 * Ne jette jamais : renvoie ce qui est lisible.
 */
export function marketsFromGameZip(json: unknown, home: string, away: string): DayMarket[] {
  const root = getValue(json);
  if (!root) return [];
  const found = new Map<string, DaySelection[]>();

  const walk = (node: unknown, group: string | null, isRoot = false) => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) {
      for (const item of node) walk(item, group);
      return;
    }
    const n = node as Record<string, unknown>;
    let current = group;
    if (looksLikeGroup(n)) current = String(n.G).trim();
    // À la racine : si des groupes existent déjà (GE/ME), le E racine est un doublon du principal.
    const skipE = isRoot && (Array.isArray(n.GE) || Array.isArray(n.ME));
    if (Array.isArray(n.E) && !skipE) {
      const label = current ?? (isMainResultRoot(n) ? "Résultat du match" : "Marchés");
      const sels = found.get(label) ?? [];
      for (const c of n.E as unknown[]) {
        const s = toSelection((c ?? {}) as RawCoeff, home, away);
        if (s) sels.push(s);
      }
      if (sels.length) found.set(label, sels);
    }
    for (const [k, v] of Object.entries(n)) {
      if (k === "E") continue; // déjà traité
      walk(v, current);
    }
  };

  walk(root, null, true);

  const markets: DayMarket[] = [];
  for (const [name, sels] of found) {
    // dédoublonne par (code, param)
    const seen = new Set<string>();
    const selections = sels.filter((s) => {
      const key = `${s.code}/${s.param ?? "-"}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    if (selections.length) markets.push({ name, selections });
  }
  return markets;
}

function getValue(json: unknown): Record<string, unknown> | null {
  if (!json || typeof json !== "object") return null;
  const v = (json as { Value?: unknown }).Value;
  if (v && typeof v === "object" && !Array.isArray(v)) return v as Record<string, unknown>;
  return null;
}

export function eventLive(ev: EventZip): boolean {
  if (!ev.SC || typeof ev.SC !== "object") return false;
  return "CP" in (ev.SC as object);
}

export { eventKickoff };
