import type { Panier, ScanParams, XbetLeg } from "./types";
import { ymd } from "../format";

export function productOf(legs: XbetLeg[]) {
  return legs.reduce((p, l) => p * l.odd, 1);
}

const byKickoff = (a: XbetLeg, b: XbetLeg) =>
  +new Date(a.kickoff) - +new Date(b.kickoff) || a.eventId - b.eventId;

/**
 * Découpe le pool en paniers dont CHACUN atteint la cote totale minimale
 * (`minProduct`, 1,50 par défaut). Un panier à 1,05 ne sert à rien :
 * - on cherche le PLUS GRAND nombre de paniers possible (découpe quasi égale,
 *   dans l'ordre des coups d'envoi) dont chaque produit atteint la cible ;
 * - ce qui reste ne suffit pas → on ne crée pas de panier « filler » ;
 * - au pire : UN SEUL panier qui regroupe tout (meilleures cotes, plafond
 *   `maxLegs` — plafond 1xBet), même si la cible n'est pas atteignable.
 */
export function buildPaniers(pool: XbetLeg[], p: ScanParams, day = ymd()): Panier[] {
  const target = Math.max(1.0001, Number(p.minProduct) || 1.5);
  const maxLegs = Math.max(1, Math.min(50, Math.round(Number(p.maxLegs)) || 50));
  const maxPaniers = Math.max(1, Math.min(8, Math.round(Number(p.maxPaniers)) || 5));
  const nowMs = Date.now();
  const now = new Date().toISOString();

  // Jamais de jambe déjà commencée dans un panier (sécurité, surtout sur l'ingest téléphone).
  const legs = [...pool].filter((l) => +new Date(l.kickoff) > nowMs).sort(byKickoff);
  if (!legs.length) return [];

  const make = (selected: XbetLeg[], n: number): Panier => ({
    id: `${day}-${n}`,
    day,
    createdAt: now,
    product: productOf(selected),
    legs: selected,
  });

  // Le meilleur panier possible (les `maxLegs` cotes les plus fortes) fait foi :
  // s'il n'atteint pas la cible, inutile d'empiler des paniers — un seul qui a tout.
  const best = [...legs].sort((a, b) => b.odd - a.odd).slice(0, maxLegs).sort(byKickoff);
  if (productOf(best) < target) return [make(best, 1)];

  // Le plus grand nombre de paniers dont CHACUN atteint la cible (on redescend
  // jusqu'à 2 ; à 1 on tombe sur le panier unique « tout » ci-dessous).
  for (let m = Math.min(maxPaniers, legs.length); m >= 2; m--) {
    const groups = splitEven(legs, m, maxLegs);
    if (groups.length === m && groups.every((g) => productOf(g) >= target)) {
      return groups.map(make);
    }
  }
  // Aucune découpe multi-paniers n'atteint la cible → un seul panier « tout ».
  return [make(best, 1)];
}

/** Découpe quasi égalisée (écarts ≤ 1 jambe) en m groupes de ≤ maxLegs. */
function splitEven(legs: XbetLeg[], m: number, maxLegs: number): XbetLeg[][] {
  const out: XbetLeg[][] = [];
  let i = 0;
  while (out.length < m && i < legs.length) {
    const left = m - out.length;
    const size = Math.min(maxLegs, Math.ceil((legs.length - i) / left));
    out.push(legs.slice(i, i + size));
    i += size;
  }
  return out;
}

export function purgeStarted(paniers: Panier[], now = Date.now()) {
  return paniers.filter((b) => b.legs.every((l) => +new Date(l.kickoff) > now));
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
