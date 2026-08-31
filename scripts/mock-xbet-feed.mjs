/**
 * Mock du feed 1xBet (moteur BetB2B) pour tester le scan de bout en bout.
 * - GET1x2_VZip : liste d'événements pré-match (quelques cotes en bande dans E)
 * - GetGameZip : marchés complets d'un match, ~55% ont une cote 1,007–1,01
 * - Gate 406 : sans Origin/Referer cohérents → NotAcceptable, comme le vrai feed
 *
 * Usage : node scripts/mock-xbet-feed.mjs (écoute sur 127.0.0.1:8787)
 */
import http from "node:http";

const PORT = 8787;
const IN_BAND = [1.007, 1.008, 1.009, 1.01, 1.0075, 1.0085, 1.0095];
const OUT_BAND = [1.02, 1.05, 1.18, 1.44, 1.9, 2.3, 1.03, 1.015];

const LEAGUES = [
  "Ligue 1 CI",
  "Premier League",
  "LaLiga",
  "Serie A",
  "Bundesliga",
  "Ligue 1",
  "Championship",
  "Eredivisie",
];
const SPORTS = ["Football", "Basketball", "Tennis", "Hockey", "Volleyball", "Handball"];
const TEAMS = [
  "ASEC Mimosas", "Africa Sports", "ASEC", "Stade d'Abidjan", "Séwé", "San Pedro",
  "Arsenal", "Chelsea", "Liverpool", "Barcelona", "Real Madrid", "Atlético",
  "Inter", "Milan", "Juventus", "Napoli", "Bayern", "Dortmund", "Lyon", "Marseille",
  "PSG", "Monaco", "Ajax", "PSV", "Feyenoord", "Everton", "Newcastle", "Villa",
];

function rnd(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

/** 240 événements pré-match, kickoffs entre +35 min et +10 h. */
const events = Array.from({ length: 240 }, (_, i) => {
  const id = 1_000_000 + i;
  const kickoff = Math.floor((Date.now() + (35 + Math.random() * 560) * 60_000) / 1000);
  const sportIdx = Math.floor(Math.random() * SPORTS.length);
  const home = rnd(TEAMS);
  let away = rnd(TEAMS);
  while (away === home) away = rnd(TEAMS);
  // ~8% des matchs exposent déjà une cote en bande dans la liste
  const listCoeffs =
    Math.random() < 0.08
      ? [
          { T: 1, C: rnd([1.2, 1.5, 2.1]), P: null },
          { T: 4, C: rnd(IN_BAND), P: null },
          { T: 9, C: rnd(OUT_BAND), P: 1.5 },
        ]
      : [
          { T: 1, C: rnd(OUT_BAND), P: null },
          { T: 2, C: rnd(OUT_BAND), P: null },
          { T: 3, C: rnd(OUT_BAND), P: null },
        ];
  return {
    I: id,
    O1: home,
    O2: away,
    L: rnd(LEAGUES),
    SN: SPORTS[sportIdx],
    S: kickoff,
    E: listCoeffs,
  };
});
const byId = new Map(events.map((e) => [e.I, e]));

function gameZip(ev) {
  const inBand = Math.random() < 0.55;
  const band = inBand
    ? [
        { G: "Résultat du match", E: [{ T: 1, C: 1.2 }, { T: 2, C: 5.4 }, { T: 3, C: 3.1 }] },
        {
          G: "Double chance",
          E: [
            { T: 4, C: rnd(IN_BAND), P: null },
            { T: 5, C: 1.03 },
            { T: 6, C: 1.04 },
          ],
        },
        { G: "Total buts", E: [{ T: 9, C: 1.7, P: 0.5 }, { T: 10, C: 1.25, P: 0.5 }] },
      ]
    : [
        { G: "Résultat du match", E: [{ T: 1, C: 1.9 }, { T: 2, C: 3.4 }, { T: 3, C: 4.2 }] },
        { G: "Total buts", E: [{ T: 9, C: 1.65, P: 2.5 }, { T: 10, C: 2.2, P: 2.5 }] },
        { G: "Les deux marquent", E: [{ T: 180, C: 1.57 }, { T: 181, C: 2.4 }] },
      ];
  return { Value: { I: ev.I, O1: ev.O1, O2: ev.O2, L: ev.L, SN: ev.SN, S: ev.S, GE: band } };
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
  const origin = req.headers.origin;
  const referer = req.headers.referer;

  // Gate BetB2B : sans Origin/Referer du skin → 406 NotAcceptable (comme en vrai)
  if (!origin || !referer || !referer.startsWith(origin)) {
    res.writeHead(406, { "content-type": "application/json" });
    res.end(
      JSON.stringify({
        type: "feed/NotAcceptableException",
        title: "NotAcceptable",
        status: 406,
        detail: "Error occurred during request execution. Contact the developer.",
      }),
    );
    return;
  }

  if (url.pathname === "/service-api/LineFeed/Get1x2_VZip") {
    const sports = Number(url.searchParams.get("sports") ?? 1);
    const count = Number(url.searchParams.get("count") ?? 50);
    const subset = events.filter((_, i) => i % SPORTS.length === sports % SPORTS.length).slice(0, count);
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ Value: subset }));
    return;
  }

  if (url.pathname === "/service-api/LineFeed/GetGameZip") {
    const id = Number(url.searchParams.get("id"));
    const ev = byId.get(id);
    if (!ev) {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ Value: null }));
      return;
    }
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify(gameZip(ev)));
    return;
  }

  res.writeHead(404, { "content-type": "application/json" });
  res.end(JSON.stringify({ error: "not found" }));
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`mock 1xBet feed sur http://127.0.0.1:${PORT} (${events.length} événements)`);
});
