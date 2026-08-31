export type MatchStatus = "scheduled" | "live" | "ht" | "finished" | "postponed";

export type DataSource =
  | "api-football"
  | "football-data"
  | "odds-api"
  | "highlightly"
  | "model"
  | "fallback";

export type Team = {
  id: string;
  name: string;
  short: string;
  crest: string;
};

export type League = {
  id: string;
  name: string;
  country: string;
  crest: string;
};

export type MatchEvent = {
  minute: number;
  extra?: number;
  type: "goal" | "own_goal" | "penalty" | "yellow" | "red" | "sub" | "var";
  team: "home" | "away";
  player: string;
  assist?: string;
};

export type OddsQuote = {
  bookmaker: string;
  home: number;
  draw: number;
  away: number;
  over25?: number;
  under25?: number;
  bttsYes?: number;
  bttsNo?: number;
};

export type Prediction = {
  home: number;
  draw: number;
  away: number;
  xgHome: number;
  xgAway: number;
  pick: "home" | "draw" | "away";
  confidence: number;
  advice: string;
  source: DataSource;
};

export type Match = {
  id: string;
  kickoff: string;
  status: MatchStatus;
  minute: number | null;
  league: League;
  home: Team;
  away: Team;
  score: { home: number | null; away: number | null };
  events: MatchEvent[];
  odds: OddsQuote[];
  prediction?: Prediction;
  venue?: string;
  referee?: string;
  sources: DataSource[];
  highlightUrl?: string;
  highlightThumb?: string;
};

export type LineupPlayer = {
  name: string;
  number: number;
  pos: "G" | "D" | "M" | "F";
  x: number;
  y: number;
};

export type MatchDetail = Match & {
  lineups?: {
    home: { formation: string; start: LineupPlayer[]; bench: string[] };
    away: { formation: string; start: LineupPlayer[]; bench: string[] };
  };
  stats?: {
    label: string;
    home: number;
    away: number;
  }[];
  h2h?: { date: string; home: string; away: string; score: string }[];
  form?: { home: ("W" | "D" | "L")[]; away: ("W" | "D" | "L")[] };
};

export type StandingRow = {
  rank: number;
  team: Team;
  played: number;
  won: number;
  draw: number;
  lost: number;
  gf: number;
  ga: number;
  gd: number;
  pts: number;
  form: ("W" | "D" | "L")[];
};

export type Highlight = {
  id: string;
  title: string;
  matchId?: string;
  league: string;
  date: string;
  duration: string;
  thumb: string;
  url?: string;
  home: string;
  away: string;
};

export type ValueBet = {
  match: Match;
  side: "home" | "draw" | "away";
  bookmaker: string;
  odds: number;
  modelProb: number;
  implied: number;
  edge: number;
};

export type ProviderHealth = {
  id: DataSource;
  ok: boolean;
  latencyMs: number | null;
  detail: string;
};
