/**
 * Mock du feed 1xBet (moteur BetB2B) — journée complète, pour tester :
 *  - le scan des paniers 1,01 (Get1x2_VZip + GetGameZip, gate 406 incluse)
 *  - la ligne du jour /api/xbet/day (toutes ligues, tous marchés)
 *
 * Données : hier / aujourd'hui / demain, plusieurs sports, matchs commencés et
 * live (SC.CP), matchs pièges (Home/Away, sans heure), groupes de marchés nommés,
 * codes inconnus, cotes en CV string, structures imbriquées (ME), et pannes
 * aléatoires mais déterministes de GetGameZip (id % 13 === 0 → 500).
 *
 * Usage : node scripts/mock-xbet-feed.mjs   (écoute sur 127.0.0.1:8787)
 */
import http from "node:http";

const PORT = 8787;

/* RNG seedée → tests reproductibles. */
let seed = 20240831;
function rnd() {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];

const IN_BAND = [1.007, 1.008, 1.009, 1.01, 1.0075, 1.0085, 1.0095];
const OUT_BAND = [1.02, 1.05, 1.18, 1.44, 1.9, 2.3, 1.03, 1.015, 1.66, 2.1];

const TEAMS_FOOT = [
  "ASEC Mimosas", "Africa Sports", "Stade d'Abidjan", "Séwé Sport", "FC San Pedro",
  "Arsenal", "Chelsea", "Liverpool", "Manchester City", "Tottenham",
  "Barcelona", "Real Madrid", "Atlético", "Séville", "Valencia",
  "Inter", "Milan", "Juventus", "Napoli", "Atalanta",
  "Bayern", "Dortmund", "Leverkusen", "Leipzig",
  "PSG", "Marseille", "Lyon", "Monaco", "Lille", "Nice",
  "Ajax", "PSV", "Feyenoord", "Twente",
  "Benfica", "Porto", "Sporting CP", "Braga",
  "Galatasaray", "Fenerbahçe", "Beşiktaş", "Trabzonspor",
];
const TEAMS_BASKET = ["Lakers", "Celtics", "Warriors", "Heat", "Bulls", "Knicks", "Real Madrid", "Panathinaïkos", "Fenerbahçe", "Barcelona Lassa"];
const TEAMS_TENNIS = ["Djokovic", "Alcaraz", "Sinner", "Medvedev", "Zverev", "Rublev", "Rune", "Musetti"];
const TEAMS_HOCKEY = ["CSKA Moscou", "SKA", "Dynamo Moscou", "Ak Bars", "Metallurg"];
const TEAMS_VOLLEY = ["Tours VB", "Montpellier", "Poitiers", "Chaumont", "Cannes"];
const TEAMS_HAND = ["PSG Handball", "Montpellier HB", "Nantes", "Aix", "Chambery"];

/* sport id 1xBet → (nom FR, ligues du jour, équipes) */
const SPORTS = [
  { si: 1, sn: "Football", leagues: ["Ligue 1 CI", "Premier League", "LaLiga", "Serie A", "Bundesliga", "Ligue 1", "Championship", "Eredivisie", "Liga Portugal", "Süper Lig"], teams: TEAMS_FOOT, per: [6, 7, 7, 7, 6, 6, 6, 5, 5, 5] },
  { si: 3, sn: "Basketball", leagues: ["NBA", "Euroligue"], teams: TEAMS_BASKET, per: [6, 4] },
  { si: 4, sn: "Tennis", leagues: ["ATP Masters"], teams: TEAMS_TENNIS, per: [5] },
  { si: 2, sn: "Hockey", leagues: ["KHL"], teams: TEAMS_HOCKEY, per: [4] },
  { si: 6, sn: "Volleyball", leagues: ["Ligue A"], teams: TEAMS_VOLLEY, per: [3] },
  { si: 8, sn: "Handball", leagues: ["StarLigue"], teams: TEAMS_HAND, per: [3] },
];

const day0 = new Date();
const MIDNIGHT = Date.UTC(
  day0.getUTCFullYear(),
  day0.getUTCMonth(),
  day0.getUTCDate(),
);

let nextId = 1_000_000;
const events = [];

function twoTeams(pool) {
  const a = pick(pool);
  let b = pick(pool);
  while (b === a) b = pick(pool);
  return [a, b];
}

function baseE(sn, home, away) {
  if (sn === "Football") {
    const e = [
      { T: 1, C: pick(OUT_BAND), P: null, N: home },
      { T: 2, C: pick(OUT_BAND), P: null, N: "Nul" },
      { T: 3, C: pick(OUT_BAND), P: null, N: away },
    ];
    if (rnd() < 0.08) e.push({ T: 4, C: pick(IN_BAND), P: null, N: `${home} ou Nul` });
    return e;
  }
  if (sn === "Tennis") {
    return [
      { T: 401, C: pick(OUT_BAND), P: null, N: home },
      { T: 402, C: pick(OUT_BAND), P: null, N: away },
    ];
  }
  return [
    { T: 1, C: pick(OUT_BAND), P: null, N: home },
    { T: 2, C: pick(OUT_BAND), P: null, N: "Nul" },
    { T: 3, C: pick(OUT_BAND), P: null, N: away },
  ];
}

function addEvent({ si, sn, league, teams, kickoffMs, decoy = "none" }) {
  const id = nextId++;
  const [home, away] = teams ?? twoTeams(SPORTS.find((s) => s.si === si).teams);
  const ev = {
    I: id,
    SI: si,
    SN: sn,
    L: league,
    O1: decoy === "placeholder" ? "Home" : home,
    O2: decoy === "placeholder" ? "Away" : away,
    S: decoy === "nokickoff" ? undefined : Math.floor(kickoffMs / 1000),
    E: baseE(sn, home, away),
  };
  if (decoy === "nokickoff") delete ev.S;
  const now = Date.now();
  if (kickoffMs < now && now - kickoffMs < 3 * 3600_000) {
    ev.SC = { CP: `${Math.floor(rnd() * 3)}:${Math.floor(rnd() * 3)}` }; // live
  }
  events.push(ev);
  return ev;
}

/* ── Hier : 8 matchs (tous passés) ── */
for (let i = 0; i < 8; i++) {
  const sp = SPORTS[i % 2 === 0 ? 0 : 1];
  addEvent({
    si: sp.si,
    sn: sp.sn,
    league: sp.leagues[i % sp.leagues.length],
    kickoffMs: MIDNIGHT - 8 * 3600_000 + i * 45 * 60_000,
  });
}

/* ── Aujourd'hui : toutes les ligues, heures étalées sur la journée ──
   70 % à venir (le scan paniers a toujours de quoi travailler, quelle que soit
   l'heure du test), 30 % déjà commencés/live (la journée les montre aussi). */
let slot = 0;
const now0 = Date.now();
for (const sp of SPORTS) {
  sp.leagues.forEach((league, li) => {
    const n = sp.per[li];
    for (let k = 0; k < n; k++) {
      slot += 1;
      let kickoffMs;
      if (slot % 10 < 7) {
        const endOfDay = MIDNIGHT + 24 * 3600_000;
        const span = Math.max(endOfDay - now0 - 30 * 60_000, 60 * 60_000);
        kickoffMs = Math.min(now0 + 25 * 60_000 + ((slot * 53) % span), endOfDay - 5 * 60_000);
      } else {
        const past = Math.max(now0 - MIDNIGHT, 2 * 3600_000);
        kickoffMs = MIDNIGHT + ((slot * 61) % past);
      }
      addEvent({ si: sp.si, sn: sp.sn, league, kickoffMs });
    }
  });
}
/* pièges : Home/Away (exclus), sans heure (exclus) */
addEvent({ si: 1, sn: "Football", league: "Ligue 1 CI", kickoffMs: MIDNIGHT + 21 * 3600_000, decoy: "placeholder" });
addEvent({ si: 1, sn: "Football", league: "Ligue 1 CI", kickoffMs: MIDNIGHT + 22 * 3600_000, decoy: "nokickoff" });

/* ── Demain : 14 matchs ── */
for (let i = 0; i < 14; i++) {
  const sp = SPORTS[i % 3];
  addEvent({
    si: sp.si,
    sn: sp.sn,
    league: sp.leagues[i % sp.leagues.length],
    kickoffMs: MIDNIGHT + 24 * 3600_000 + 6 * 3600_000 + i * 55 * 60_000,
  });
}

const byId = new Map(events.map((e) => [e.I, e]));

/** Tous les marchés d'un match — groupes nommés, codes connus/inconnus, CV string, imbrication ME. */
function gameZip(ev) {
  const { O1: home, O2: away, SN: sn } = ev;
  const root = {
    I: ev.I,
    O1: home,
    O2: away,
    L: ev.L,
    SN: sn,
    S: ev.S,
    E: ev.E,
  };

  if (sn !== "Football") {
    root.GE = [
      { G: "Résultat du match", E: ev.E },
      {
        G: "Total points",
        E: [
          { T: 9, P: 210.5, C: 1.87, N: "Plus de 210,5" },
          { T: 10, P: 210.5, C: 1.93, N: "Moins de 210,5" },
        ],
      },
      {
        G: "Handicap",
        E: [
          { T: 7, P: 4.5, C: 1.72, N: `${home} (+4,5)` },
          { T: 8, P: -4.5, C: 2.12, N: `${away} (-4,5)` },
        ],
      },
    ];
    return { Value: root };
  }

  const doubleChance = [
    { T: 4, C: rnd() < 0.55 ? pick(IN_BAND) : 1.03, P: null, N: `${home} ou Nul` },
    { T: 5, C: 1.035, P: null, N: `${home} ou ${away}` },
    { T: 6, C: 1.045, P: null, N: `Nul ou ${away}` },
  ];

  root.GE = [
    { G: "Double chance", E: doubleChance },
    {
      G: "Total buts",
      E: [
        { T: 9, P: 0.5, C: 0, CV: "1.085", N: "Plus de 0,5 but" },
        { T: 10, P: 0.5, C: 1.12, N: "Moins de 0,5 but" },
        { T: 9, P: 1.5, C: 1.36, N: "Plus de 1,5 buts" },
        { T: 10, P: 1.5, C: 1.25, N: "Moins de 1,5 buts" },
        { T: 9, P: 2.5, C: 1.85, N: "Plus de 2,5 buts" },
        { T: 10, P: 2.5, C: 2.02, N: "Moins de 2,5 buts" },
      ],
    },
    {
      G: "Handicap",
      E: [
        { T: 7, P: 1, C: 1.22, N: `${home} (+1)` },
        { T: 8, P: 1, C: 1.65, N: `${away} (-1)` },
        { T: 7, P: 2, C: 1.06, N: `${home} (+2)` },
        { T: 8, P: 2, C: 1.28, N: `${away} (-2)` },
      ],
    },
    {
      G: "Les deux équipes marquent",
      E: [
        { T: 180, C: 1.75, N: "Oui" },
        { T: 181, C: 2.05, N: "Non" },
      ],
    },
    {
      G: "Score exact",
      E: [
        { T: 46, P: 101, C: 6.5, N: "1:0" },
        { T: 46, P: 102, C: 8.0, N: "2:0" },
        { T: 46, P: 103, C: 5.2, N: "1:1" },
        { T: 46, P: 104, C: 9.5, N: "2:1" },
        { T: 46, P: 105, C: 11.0, N: "0:0" },
      ],
    },
    {
      G: "Mi-temps / fin de match",
      ME: [
        { G: "1 / 1", E: [{ T: 850, C: 3.2, N: `${home} / ${home}` }] },
        { G: "1 / Nul", E: [{ T: 851, C: 8.5, N: `${home} / Nul` }] },
        { G: "Nul / Nul", E: [{ T: 857, C: 5.5, N: "Nul / Nul" }] },
      ],
    },
    {
      G: "Marché spécial",
      E: [
        { T: 9999, C: 2.2, N: "Code inconnu — doit quand même s'afficher" },
        { T: 46, P: 201, C: 4.4, N: "Autre groupe, même code" },
      ],
    },
  ];
  return { Value: root };
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
  const origin = req.headers.origin;
  const referer = req.headers.referer;

  // Kill switch de test : /__mode?down=1 fait tomber le feed (503 sur tout).
  if (url.pathname === "/__mode") {
    const down = url.searchParams.get("down") === "1";
    req.socket.server.__down = down;
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ down }));
    return;
  }

  if (req.socket.server.__down) {
    res.writeHead(503, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: "feed down (mode test)" }));
    return;
  }

  // Gate BetB2B : sans Origin/Referer cohérents → 406 NotAcceptable (comme le vrai feed)
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
    const subset = events.filter((e) => e.SI === sports).slice(0, count);
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ Value: subset }));
    return;
  }

  if (url.pathname === "/service-api/LineFeed/GetGameZip") {
    const id = Number(url.searchParams.get("id"));
    const ev = byId.get(id);
    if (id % 13 === 0) {
      // panne déterministe : le scraper doit dégrader proprement
      res.writeHead(500, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: "boom" }));
      return;
    }
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
  const today = events.filter((e) => e.S >= MIDNIGHT / 1000 && e.S < MIDNIGHT / 1000 + 86400).length;
  console.log(
    `mock 1xBet feed sur http://127.0.0.1:${PORT} · ${events.length} événements (${today} aujourd'hui, ${byId.size} ids) · pannes GetGameZip: id%13`,
  );
});
