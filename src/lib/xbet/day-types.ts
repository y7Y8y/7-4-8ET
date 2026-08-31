/** Types de la ligne du jour 1xBet (toutes ligues, tous marchés). */

export type DaySelection = {
  code: number;
  name: string;
  odd: number;
  param?: number;
};

export type DayMarket = {
  name: string;
  selections: DaySelection[];
};

export type DayMatch = {
  id: number;
  sport: string;
  league: string;
  home: string;
  away: string;
  kickoff: string; // ISO
  started: boolean; // coup d'envoi passé
  live: boolean; // SC détecté dans la liste
  markets: DayMarket[];
  marketCount: number;
  enriched: boolean; // marchés complets (GetGameZip) vs base (liste)
};

export type DayLeague = {
  sport: string;
  league: string;
  matches: DayMatch[];
};

export type DayStats = {
  matches: number;
  leagues: number;
  markets: number;
  enriched: number;
};

export type DayLine = {
  day: string; // YYYY-MM-DD (UTC)
  generatedAt: string; // ISO
  host: string | null;
  stats: DayStats;
  partial: boolean; // enrichissement incomplet (budget / erreurs) — data quand même utilisable
  error: string | null;
  leagues: DayLeague[];
};
