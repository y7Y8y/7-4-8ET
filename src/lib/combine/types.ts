export type CombineParams = {
  oddMin: number;
  oddMax: number;
  target: number;
  fallback: number;
  bufferMin: number;
  maxLegs: number;
  onePerMatch: boolean;
  minStake: number;
  currency: string;
};

export const DEFAULT_PARAMS: CombineParams = {
  oddMin: 1.007,
  oddMax: 1.01,
  target: 10,
  fallback: 5,
  bufferMin: 20,
  maxLegs: 320,
  onePerMatch: true,
  minStake: 100,
  currency: "FCFA",
};

export type CombineLeg = {
  id: string;
  matchKey: string;
  league: string;
  home: string;
  away: string;
  kickoff: string;
  market: string;
  pick: string;
  odd: number;
  source: "odds-api" | "demo";
  bookmaker: "1xBet";
};

export type Basket = {
  target: number;
  ok: boolean;
  product: number;
  legs: CombineLeg[];
  missingFactor: number;
  needed: number;
};

export type CombineScan = {
  scannedAt: string;
  source: "odds-api" | "demo" | "mixed";
  params: CombineParams;
  legs: CombineLeg[];
  liveRejected: number;
  outOfRange: number;
};
