export const env = {
  apiFootball: process.env.API_FOOTBALL_KEY ?? "",
  footballData: process.env.FOOTBALL_DATA_KEY ?? "",
  oddsApi: process.env.ODDS_API_KEY ?? "",
  highlightly: process.env.HIGHLIGHTLY_KEY ?? "",
};

export function hasKey(name: keyof typeof env) {
  return env[name].length > 8;
}
