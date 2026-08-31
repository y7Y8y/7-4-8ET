import type { CombineLeg } from "./types";

const LEAGUES: Array<{ name: string; teams: string[] }> = [
  {
    name: "Premier League",
    teams: [
      "Manchester City",
      "Arsenal",
      "Liverpool",
      "Chelsea",
      "Newcastle",
      "Aston Villa",
      "Manchester United",
      "Tottenham",
      "Brighton",
      "Everton",
    ],
  },
  {
    name: "La Liga",
    teams: ["Real Madrid", "Barcelona", "Atlético Madrid", "Athletic", "Real Sociedad", "Villarreal", "Real Betis", "Girona"],
  },
  {
    name: "Serie A",
    teams: ["Inter", "Milan", "Juventus", "Napoli", "Roma", "Atalanta", "Lazio", "Bologna"],
  },
  {
    name: "Bundesliga",
    teams: ["Bayern", "Leverkusen", "Dortmund", "Leipzig", "Frankfurt", "Stuttgart", "Wolfsburg", "Freiburg"],
  },
  {
    name: "Ligue 1",
    teams: ["Paris SG", "Monaco", "Lille", "Lyon", "Marseille", "Lens", "Rennes", "Nice"],
  },
  {
    name: "Liga Portugal",
    teams: ["Benfica", "Porto", "Sporting", "Braga", "Guimarães", "Boavista"],
  },
  {
    name: "Eredivisie",
    teams: ["Ajax", "PSV", "Feyenoord", "AZ Alkmaar", "Twente", "Utrecht"],
  },
  {
    name: "Championship",
    teams: ["Leeds", "Burnley", "Sheffield United", "Middlesbrough", "Norwich", "West Brom", "Sunderland", "Coventry"],
  },
  {
    name: "Ligue 2",
    teams: ["Metz", "Bordeaux", "Saint-Étienne", "Caen", "Guingamp", "Bastia", "Amiens", "Grenoble"],
  },
  {
    name: "Serie B",
    teams: ["Palermo", "Parma", "Sampdoria", "Spezia", "Venezia", "Pisa", "Bari", "Cosenza"],
  },
  {
    name: "2. Bundesliga",
    teams: ["Schalke", "Hertha", "Hamburg", "Köln", "Hannover", "Nürnberg", "Kaiserslautern", "Magdeburg"],
  },
  {
    name: "Brésil Série A",
    teams: ["Flamengo", "Palmeiras", "Fluminense", "Botafogo", "São Paulo", "Corinthians", "Atlético Mineiro", "Grêmio"],
  },
  {
    name: "MLS",
    teams: ["Inter Miami", "LAFC", "Columbus", "Cincinnati", "Seattle", "Atlanta", "NYCFC", "Dallas"],
  },
  {
    name: "J1 League",
    teams: ["Kawasaki", "Yokohama FM", "Urawa", "Kashima", "Cerezo", "Gamba Osaka", "Sanfrecce", "Vissel Kobe"],
  },
  {
    name: "K League 1",
    teams: ["Ulsan", "Jeonbuk", "Seoul", "Pohang", "Gwangju", "Daejeon"],
  },
  {
    name: "Saudi Pro League",
    teams: ["Al Hilal", "Al Nassr", "Al Ittihad", "Al Ahli", "Al Shabab", "Al Ettifaq"],
  },
  {
    name: "Liga MX",
    teams: ["América", "Monterrey", "Chivas", "Tigres", "Cruz Azul", "Pumas", "Toluca", "León"],
  },
  {
    name: "Super Lig",
    teams: ["Galatasaray", "Fenerbahçe", "Beşiktaş", "Trabzonspor", "Başakşehir", "Samsunspor"],
  },
  {
    name: "Pro League BE",
    teams: ["Club Brugge", "Anderlecht", "Genk", "Union SG", "Antwerp", "Gent"],
  },
  {
    name: "Superliga DK",
    teams: ["Copenhagen", "Midtjylland", "Brøndby", "Nordsjælland", "Aarhus", "Randers"],
  },
  {
    name: "Allsvenskan",
    teams: ["Malmö", "Djurgården", "Hammarby", "AIK", "Elfsborg", "Häcken"],
  },
  {
    name: "Argentine Primera",
    teams: ["River Plate", "Boca Juniors", "Racing", "Independiente", "San Lorenzo", "Estudiantes"],
  },
  {
    name: "A-League",
    teams: ["Melbourne City", "Sydney FC", "Auckland FC", "Adelaide", "Wanderers", "Brisbane"],
  },
  {
    name: "Ligue des Champions",
    teams: ["Real Madrid", "Barcelona", "Bayern", "Manchester City", "Inter", "Arsenal", "PSG", "Liverpool"],
  },
];

const MARKETS: Array<(h: string, a: string, i: number) => { market: string; pick: string }> = [
  (h) => ({ market: "Handicap asiatique", pick: `${h} -3.5` }),
  (h) => ({ market: "Handicap asiatique", pick: `${h} -4.5` }),
  () => ({ market: "Total buts", pick: "Plus de 0.5" }),
  (h) => ({ market: "Équipe à marquer", pick: `${h} marque oui` }),
  (h) => ({ market: "Double chance", pick: `1X ${h}` }),
  () => ({ market: "Total corners", pick: "Plus de 0.5" }),
];

function oddFor(i: number) {
  const r = i % 10;
  if (r < 8) return 1.01;
  if (r === 8) return 1.009;
  return 1.008;
}

/** Paniers démo : kickoffs toujours dans le futur, clairement tagués `demo`. */
export function demoLegs(now = Date.now()): CombineLeg[] {
  const start = now + 3 * 3600_000;
  const out: CombineLeg[] = [];
  let n = 0;
  for (let day = 0; day < 14 && n < 320; day++) {
    for (const league of LEAGUES) {
      const teams = league.teams;
      for (let i = 0; i + 1 < teams.length && n < 320; i += 2) {
        const home = teams[i];
        const away = teams[(i + 1 + day) % teams.length];
        if (home === away) continue;
        const kickoff = new Date(start + n * 22 * 60_000).toISOString();
        const mk = MARKETS[n % MARKETS.length](home, away, n);
        const matchKey = `${league.name}:${home}:${away}:${kickoff.slice(0, 13)}`;
        out.push({
          id: `demo-${n}`,
          matchKey,
          league: league.name,
          home,
          away,
          kickoff,
          market: mk.market,
          pick: mk.pick,
          odd: oddFor(n),
          source: "demo",
          bookmaker: "1xBet",
        });
        n += 1;
      }
    }
  }
  return out;
}
