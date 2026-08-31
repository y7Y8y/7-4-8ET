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
