export type XbetLeg = {
  id: string;
  eventId: number;
  sport: string;
  league: string;
  home: string;
  away: string;
  kickoff: string;
  market: string;
  pick: string;
  odd: number;
  host: string;
};

export type Panier = {
  id: string;
  day: string;
  createdAt: string;
  product: number;
  legs: XbetLeg[];
};

export type XbetState = {
  day: string;
  scannedAt: string | null;
  host: string | null;
  pool: number;
  paniers: Panier[];
  error: string | null;
};

export type ScanParams = {
  oddMin: number;
  oddMax: number;
  bufferMin: number;
  maxLegs: number;
  maxPaniers: number;
};

export const SCAN_DEFAULTS: ScanParams = {
  oddMin: 1.007,
  oddMax: 1.01,
  bufferMin: 20,
  maxLegs: 50,
  maxPaniers: 5,
};
