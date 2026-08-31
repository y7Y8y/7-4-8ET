import type { Basket, CombineLeg, CombineParams } from "./types";

export function stillPrematch(iso: string, bufferMin: number, now = Date.now()) {
  return new Date(iso).getTime() - now >= bufferMin * 60_000;
}

export function inOddBand(odd: number, min: number, max: number) {
  return odd + 1e-9 >= min && odd - 1e-9 <= max;
}

export function filterLegs(legs: CombineLeg[], p: CombineParams, now = Date.now()) {
  const band = legs.filter(
    (l) =>
      l.bookmaker === "1xBet" &&
      inOddBand(l.odd, p.oddMin, p.oddMax) &&
      stillPrematch(l.kickoff, p.bufferMin, now),
  );
  if (!p.onePerMatch) return band.sort(byPack);
  const best = new Map<string, CombineLeg>();
  for (const l of band) {
    const prev = best.get(l.matchKey);
    if (!prev || l.odd > prev.odd) best.set(l.matchKey, l);
  }
  return [...best.values()].sort(byPack);
}

function byPack(a: CombineLeg, b: CombineLeg) {
  if (b.odd !== a.odd) return b.odd - a.odd;
  return +new Date(b.kickoff) - +new Date(a.kickoff);
}

export function neededLegs(avgOdd: number, target: number) {
  if (avgOdd <= 1) return Infinity;
  return Math.ceil(Math.log(target) / Math.log(avgOdd));
}

export function pack(legs: CombineLeg[], target: number, maxLegs: number): Basket {
  const needed = neededLegs(1.01, target);
  if (!legs.length) {
    return { target, ok: false, product: 1, legs: [], missingFactor: target, needed };
  }
  const picked: CombineLeg[] = [];
  let product = 1;
  for (const leg of legs) {
    if (picked.length >= maxLegs) break;
    picked.push(leg);
    product *= leg.odd;
    if (product >= target) break;
  }
  const ok = product + 1e-12 >= target;
  return {
    target,
    ok,
    product,
    legs: picked,
    missingFactor: ok ? 1 : target / product,
    needed,
  };
}

export function buildBaskets(pool: CombineLeg[], p: CombineParams) {
  const filtered = filterLegs(pool, p);
  const primary = pack(filtered, p.target, p.maxLegs);
  const fallback = pack(filtered, p.fallback, p.maxLegs);
  return { filtered, primary, fallback };
}

export function couponText(b: Basket, p: CombineParams) {
  const lines = [
    `NINETY · combiné 1xBet`,
    `Cible ${b.target} · obtenue ${b.product.toFixed(4)} · ${b.legs.length} sélections`,
    `Mise de génération ${p.minStake} ${p.currency} · 18+ · pas un placement auto`,
    `Pré-match uniquement · cote [${p.oddMin}–${p.oddMax}]`,
    "",
    ...b.legs.map((l, i) => {
      const t = new Intl.DateTimeFormat("fr-FR", {
        timeZone: "Europe/Paris",
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(l.kickoff));
      return `${String(i + 1).padStart(3, "0")}. ${l.home} vs ${l.away} · ${l.market} · ${l.pick} @ ${l.odd.toFixed(3)} · ${l.league} · ${t}`;
    }),
  ];
  return lines.join("\n");
}
