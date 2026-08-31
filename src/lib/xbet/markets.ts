const T: Record<number, string> = {
  1: "1",
  2: "X",
  3: "2",
  4: "1X",
  5: "12",
  6: "X2",
  7: "Handicap 1",
  8: "Handicap 2",
  9: "Plus de",
  10: "Moins de",
  11: "Total 1 plus",
  12: "Total 1 moins",
  13: "Total 2 plus",
  14: "Total 2 moins",
  180: "Les deux marquent oui",
  181: "Les deux marquent non",
  216: "Au moins un but",
  401: "Vainqueur 1",
  402: "Vainqueur 2",
  3653: "Vainqueur (prorog. incl.)",
  3654: "Nul (prorog. incl.)",
  3655: "Vainqueur 2 (prorog. incl.)",
};

export function marketLabel(t: number, p?: number) {
  const name = T[t] ?? `Marché ${t}`;
  if (p === undefined || p === null) return name;
  const pts = p > 0 && (t === 7 || t === 8) ? `+${p}` : String(p);
  if (t === 7 || t === 8) return `${name} ${pts}`;
  if (t === 9 || t === 11 || t === 13) return `${name} ${p}`;
  if (t === 10 || t === 12 || t === 14) return `${name} ${p}`;
  return `${name} ${p}`;
}

export function pickLabel(t: number, home: string, away: string, p?: number) {
  if (t === 1 || t === 4) return home;
  if (t === 3 || t === 6) return away;
  if (t === 2) return "Nul";
  if (t === 5) return `${home} ou ${away}`;
  if (t === 7) return `${home} ${p !== undefined ? (p > 0 ? `+${p}` : p) : "0"}`;
  if (t === 8) return `${away} ${p !== undefined ? (p > 0 ? `+${p}` : p) : "0"}`;
  if (t === 9) return `Plus de ${p} buts`;
  if (t === 10) return `Moins de ${p} buts`;
  if (t === 11) return `${home} plus de ${p}`;
  if (t === 12) return `${home} moins de ${p}`;
  if (t === 13) return `${away} plus de ${p}`;
  if (t === 14) return `${away} moins de ${p}`;
  if (t === 401 || t === 3653) return home;
  if (t === 402 || t === 3655) return away;
  return marketLabel(t, p);
}
