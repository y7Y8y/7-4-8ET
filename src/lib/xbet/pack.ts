import type { Panier, ScanParams, XbetLeg } from "./types";
import { ymd } from "../format";

export function productOf(legs: XbetLeg[]) {
  return legs.reduce((p, l) => p * l.odd, 1);
}

export function buildPaniers(pool: XbetLeg[], p: ScanParams, day = ymd()): Panier[] {
  const unused = [...pool];
  const out: Panier[] = [];
  const now = new Date().toISOString();
  for (let i = 0; i < p.maxPaniers && unused.length; i++) {
    const legs = unused.splice(0, p.maxLegs);
    if (!legs.length) break;
    out.push({
      id: `${day}-${i + 1}`,
      day,
      createdAt: now,
      product: productOf(legs),
      legs,
    });
  }
  return out;
}

export type PurgeReport = {
  paniers: Panier[];
  /** jambes retirées parce que le match a commencé */
  legs: number;
  /** paniers supprimés parce qu'il ne restait plus rien dedans */
  paniers_supprimes: number;
  /** paniers encore là mais amputés d'au moins une jambe */
  paniers_reduits: number;
};

/**
 * Purge AU MATCH PRÈS.
 *
 * Un match qui a commencé n'est plus jouable : on retire **cette jambe**, pas
 * le panier entier. Le reste du panier reste jouable, avec la cote totale
 * recalculée sur les jambes qui restent. Un panier n'est supprimé que s'il ne
 * lui reste plus aucune jambe.
 */
export function purgeStartedDetailed(paniers: Panier[], now = Date.now()): PurgeReport {
  const out: Panier[] = [];
  let legs = 0;
  let supprimes = 0;
  let reduits = 0;
  for (const b of paniers) {
    const kept = (b.legs ?? []).filter((l) => +new Date(l.kickoff) > now);
    const dropped = (b.legs ?? []).length - kept.length;
    legs += dropped;
    if (!kept.length) {
      supprimes += 1;
      continue;
    }
    if (dropped > 0) reduits += 1;
    out.push(dropped ? { ...b, legs: kept, product: productOf(kept) } : b);
  }
  return { paniers: out, legs, paniers_supprimes: supprimes, paniers_reduits: reduits };
}

export function purgeStarted(paniers: Panier[], now = Date.now()) {
  return purgeStartedDetailed(paniers, now).paniers;
}

export function couponText(b: Panier) {
  return [
    `NINETY 1.01 · panier ${b.id}`,
    `${b.legs.length} sélections · cote ${b.product.toFixed(4)}`,
    `Mise mini pour le code · 18+ · pas de placement auto`,
    "",
    ...b.legs.map(
      (l, i) =>
        `${String(i + 1).padStart(2, "0")}. ${l.home} vs ${l.away} · ${l.pick} @ ${l.odd.toFixed(3)} · ${l.league}`,
    ),
  ].join("\n");
}
