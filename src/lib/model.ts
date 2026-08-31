import type { Match, Prediction, ValueBet } from "./types";
import { implied } from "./format";

/** Ratings 0–100, calibrated on early 2026/27 form + historical strength. */
export const RATINGS: Record<string, { att: number; def: number; elo: number }> = {
  "Manchester City": { att: 92, def: 88, elo: 1980 },
  Arsenal: { att: 88, def: 86, elo: 1945 },
  Liverpool: { att: 86, def: 82, elo: 1910 },
  Chelsea: { att: 84, def: 78, elo: 1860 },
  "Manchester United": { att: 80, def: 74, elo: 1810 },
  "Newcastle United": { att: 79, def: 80, elo: 1835 },
  "Aston Villa": { att: 76, def: 75, elo: 1780 },
  Brighton: { att: 77, def: 72, elo: 1765 },
  "Tottenham Hotspur": { att: 78, def: 68, elo: 1740 },
  Everton: { att: 70, def: 76, elo: 1720 },
  "Nottingham Forest": { att: 71, def: 73, elo: 1710 },
  Brentford: { att: 73, def: 71, elo: 1705 },
  Fulham: { att: 69, def: 70, elo: 1680 },
  "Crystal Palace": { att: 67, def: 72, elo: 1675 },
  Bournemouth: { att: 70, def: 68, elo: 1670 },
  "Leeds United": { att: 72, def: 69, elo: 1690 },
  "Hull City": { att: 68, def: 74, elo: 1660 },
  Sunderland: { att: 66, def: 70, elo: 1640 },
  "Ipswich Town": { att: 67, def: 64, elo: 1620 },
  "Coventry City": { att: 62, def: 63, elo: 1580 },
  Barcelona: { att: 90, def: 80, elo: 1955 },
  "Real Madrid": { att: 91, def: 82, elo: 1970 },
  "Atlético Madrid": { att: 78, def: 86, elo: 1880 },
  "Rayo Vallecano": { att: 70, def: 68, elo: 1685 },
  Osasuna: { att: 66, def: 72, elo: 1665 },
  Getafe: { att: 61, def: 74, elo: 1645 },
  Roma: { att: 78, def: 77, elo: 1815 },
  Lecce: { att: 62, def: 66, elo: 1575 },
  Atalanta: { att: 84, def: 74, elo: 1840 },
  Bologna: { att: 73, def: 75, elo: 1745 },
  Benfica: { att: 83, def: 78, elo: 1845 },
  Estoril: { att: 64, def: 65, elo: 1585 },
  Braga: { att: 76, def: 73, elo: 1755 },
  "Vitória Guimarães": { att: 68, def: 70, elo: 1660 },
  "Paris Saint-Germain": { att: 93, def: 84, elo: 1965 },
  "AS Monaco": { att: 82, def: 76, elo: 1825 },
  Lille: { att: 77, def: 79, elo: 1795 },
  Lyon: { att: 78, def: 74, elo: 1775 },
  Marseille: { att: 80, def: 72, elo: 1785 },
  Rennes: { att: 75, def: 73, elo: 1740 },
  Lens: { att: 76, def: 78, elo: 1765 },
  "Paris FC": { att: 72, def: 70, elo: 1680 },
  Troyes: { att: 67, def: 66, elo: 1610 },
  Strasbourg: { att: 73, def: 70, elo: 1700 },
  Brest: { att: 68, def: 71, elo: 1670 },
  Angers: { att: 64, def: 69, elo: 1605 },
  Lorient: { att: 66, def: 67, elo: 1625 },
  "Le Havre": { att: 62, def: 70, elo: 1595 },
  Toulouse: { att: 69, def: 68, elo: 1655 },
  Nice: { att: 71, def: 72, elo: 1710 },
  Auxerre: { att: 60, def: 64, elo: 1565 },
  "Le Mans": { att: 58, def: 62, elo: 1540 },
  "Bayern Munich": { att: 91, def: 83, elo: 1960 },
  "Bayer Leverkusen": { att: 84, def: 80, elo: 1870 },
  Dortmund: { att: 83, def: 74, elo: 1840 },
};

function rating(name: string) {
  return RATINGS[name] ?? { att: 68, def: 68, elo: 1650 };
}

function poisson(lambda: number, k: number) {
  let p = Math.exp(-lambda);
  for (let i = 1; i <= k; i++) p *= lambda / i;
  return p;
}

function matrix(lh: number, la: number) {
  const H = 8;
  let home = 0;
  let draw = 0;
  let away = 0;
  for (let i = 0; i <= H; i++) {
    for (let j = 0; j <= H; j++) {
      const p = poisson(lh, i) * poisson(la, j);
      if (i > j) home += p;
      else if (i === j) draw += p;
      else away += p;
    }
  }
  const s = home + draw + away || 1;
  return { home: home / s, draw: draw / s, away: away / s };
}

export function predict(homeName: string, awayName: string): Prediction {
  const h = rating(homeName);
  const a = rating(awayName);
  const leagueAvg = 1.35;
  const xgHome = Math.max(0.4, ((h.att / 70) * (70 / a.def) * leagueAvg * 1.12));
  const xgAway = Math.max(0.3, ((a.att / 70) * (70 / h.def) * leagueAvg * 0.92));
  const probs = matrix(xgHome, xgAway);
  const pick =
    probs.home >= probs.draw && probs.home >= probs.away
      ? "home"
      : probs.away >= probs.draw
        ? "away"
        : "draw";
  const confidence = Math.round(Math.max(probs.home, probs.draw, probs.away) * 100);
  const advice =
    pick === "home"
      ? `${homeName} est favori — xG ${xgHome.toFixed(2)} vs ${xgAway.toFixed(2)}.`
      : pick === "away"
        ? `Le modèle penche extérieur : ${awayName} (${(probs.away * 100).toFixed(0)}%).`
        : `Match ouvert. Le nul est l'issue la plus cohérente.`;
  return {
    ...probs,
    xgHome: +xgHome.toFixed(2),
    xgAway: +xgAway.toFixed(2),
    pick,
    confidence,
    advice,
    source: "model",
  };
}

export function bestOdds(match: Match) {
  if (!match.odds.length) return null;
  return match.odds.reduce(
    (acc, q) => ({
      home: Math.max(acc.home, q.home),
      draw: Math.max(acc.draw, q.draw),
      away: Math.max(acc.away, q.away),
      bookHome: q.home >= acc.home ? q.bookmaker : acc.bookHome,
      bookDraw: q.draw >= acc.draw ? q.bookmaker : acc.bookDraw,
      bookAway: q.away >= acc.away ? q.bookmaker : acc.bookAway,
    }),
    {
      home: 0,
      draw: 0,
      away: 0,
      bookHome: "",
      bookDraw: "",
      bookAway: "",
    },
  );
}

export function valueBets(matches: Match[], minEdge = 0.05): ValueBet[] {
  const out: ValueBet[] = [];
  for (const match of matches) {
    const pred = match.prediction ?? predict(match.home.name, match.away.name);
    const best = bestOdds(match);
    if (!best) continue;
    const sides: Array<["home" | "draw" | "away", number, string, number]> = [
      ["home", best.home, best.bookHome, pred.home],
      ["draw", best.draw, best.bookDraw, pred.draw],
      ["away", best.away, best.bookAway, pred.away],
    ];
    for (const [side, odds, bookmaker, modelProb] of sides) {
      const edge = modelProb * odds - 1;
      if (edge >= minEdge && modelProb >= 0.2 && odds <= 6.5) {
        out.push({
          match,
          side,
          bookmaker,
          odds,
          modelProb,
          implied: implied(odds),
          edge,
        });
      }
    }
  }
  return out.sort((a, b) => b.edge - a.edge);
}
