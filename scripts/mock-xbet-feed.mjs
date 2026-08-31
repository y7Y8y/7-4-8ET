/**
 * Mock du feed 1xBet (moteur BetB2B) — reproduit les endpoints NON verrouillés
 * découverts sur le vrai feed (vérifiés 2026-08-31 sur 1xbet.ci) :
 *
 *   GetSportsZip?top=false            → arbre sports → ligues (LI, GC)     [ouvert]
 *   GetChampZip?champ=<LI>&top=false  → matchs de la ligue (G[])           [ouvert, top=false obligatoire]
 *   GetGameZip?id=<I>&isNewBuilder…   → tous les marchés (GE par id groupe)[ouvert, pannes id%13]
 *   Get1x2_VZip                       → 406 NotAcceptable TOUJOURS (gate x-dt du service worker)
 *
 * Kill switch de test : /__mode?down=1 → 503 partout.
 * Usage : node scripts/mock-xbet-feed.mjs   (écoute sur 127.0.0.1:8787)
 */
import http from "node:http";

const PORT = 8787;

/* RNG seedée → structure (équipes, ligues) reproductible d'un run à l'autre. */
let seed = 20260831;
function rnd() {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];

/**
 * Cotes DÉTERMINISTES : dérivées de l'id du match (FNV-1a), jamais du RNG
 * global. Deux appels GetGameZip sur le même match renvoient exactement les
 * mêmes cotes, quel que soit l'ordre ou le nombre des requêtes — sans ça les
 * tests de bande ne veulent rien dire.
 */
function hash32(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
const pickFor = (arr, ...parts) => arr[hash32(parts.join(":")) % arr.length];

const IN_BAND = [1.007, 1.008, 1.009, 1.01, 1.0075, 1.0085, 1.0095];
const OUT_BAND = [1.02, 1.05, 1.18, 1.44, 1.9, 2.3, 1.03, 1.015, 1.66, 2.1];
/** Pièges collés aux bords : un scan qui « élargit » un peu les attrape. */
const EDGE_OVER = 1.0101; // juste au-dessus de 1,01
const EDGE_UNDER = 1.0069; // juste en dessous de 1,007

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

const SPORTS = [
  { si: 1, sn: "Football", leagues: ["Ligue 1 CI", "Premier League", "LaLiga", "Serie A", "Bundesliga", "Ligue 1", "Championship", "Eredivisie", "Liga Portugal", "Süper Lig"], teams: TEAMS_FOOT, per: [6, 7, 7, 7, 6, 6, 6, 5, 5, 5] },
  { si: 3, sn: "Basketball", leagues: ["NBA", "Euroligue"], teams: TEAMS_BASKET, per: [6, 4] },
  { si: 4, sn: "Tennis", leagues: ["ATP Masters"], teams: TEAMS_TENNIS, per: [5] },
  { si: 2, sn: "Hockey sur glace", leagues: ["KHL"], teams: TEAMS_HOCKEY, per: [4] },
  { si: 6, sn: "Volleyball", leagues: ["Ligue A"], teams: TEAMS_VOLLEY, per: [3] },
  { si: 8, sn: "Handball", leagues: ["StarLigue"], teams: TEAMS_HAND, per: [3] },
];

const day0 = new Date();
const MIDNIGHT = Date.UTC(day0.getUTCFullYear(), day0.getUTCMonth(), day0.getUTCDate());

let nextId = 1_000_000;
let nextLI = 100_000;
const leagues = []; // { li, name, sportId, sportName, events: [] }

function twoTeams(pool) {
  const a = pick(pool);
  let b = pick(pool);
  while (b === a) b = pick(pool);
  return [a, b];
}

function addLeague(sport, name) {
  const li = nextLI++;
  const lg = { li, name, sportId: sport.si, sportName: sport.sn, events: [] };
  leagues.push(lg);
  return lg;
}

function addEvent(lg, teams, kickoffMs, decoy = "none") {
  const id = nextId++;
  const [home, away] = teams ?? twoTeams(SPORTS.find((s) => s.si === lg.sportId).teams);
  const ev = {
    I: id,
    LI: lg.li,
    SI: lg.sportId,
    SE: lg.sportName,
    LE: lg.name,
    O1: decoy === "placeholder" ? "Home" : home,
    O2: decoy === "placeholder" ? "Away" : away,
    S: decoy === "nokickoff" ? undefined : Math.floor(kickoffMs / 1000),
    MIS: [{ K: 1, V: "Journée 3" }, { K: 2, V: "Stade de test" }],
  };
  if (decoy === "nokickoff") delete ev.S;
  lg.events.push(ev);
  return ev;
}

/* ── Hier : 8 matchs ── */
for (let i = 0; i < 8; i++) {
  const sp = SPORTS[i % 2 === 0 ? 0 : 1];
  const name = sp.leagues[i % sp.leagues.length];
  let lg = leagues.find((l) => l.sportId === sp.si && l.name === name) ?? addLeague(sp, name);
  addEvent(lg, null, MIDNIGHT - 8 * 3600_000 + i * 45 * 60_000);
}

/* ── Aujourd'hui : toutes les ligues (70 % à venir, 30 % commencés/live) ── */
let slot = 0;
const now0 = Date.now();
for (const sp of SPORTS) {
  sp.leagues.forEach((name, li) => {
    const lg = addLeague(sp, name);
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
      addEvent(lg, null, kickoffMs);
    }
  });
}
/* pièges : Home/Away et sans heure (jamais dans la ligne) */
{
  const lg = leagues.find((l) => l.name === "Ligue 1 CI");
  addEvent(lg, null, MIDNIGHT + 21 * 3600_000, "placeholder");
  addEvent(lg, null, MIDNIGHT + 22 * 3600_000, "nokickoff");
}
/* doublons « Matchs alternatifs » : mêmes ids, exclus par leaguesFromTree */
for (const name of ["Premier League", "Ligue 1"]) {
  const src = leagues.find((l) => l.name === name);
  const alt = addLeague(SPORTS[0], `${name}. Matchs alternatifs`);
  alt.events = src.events.slice(0, 3).map((e) => ({ ...e, LE: alt.name }));
}

/* ── Demain : 14 matchs ── */
for (let i = 0; i < 14; i++) {
  const sp = SPORTS[i % 3];
  const name = sp.leagues[i % sp.leagues.length];
  let lg = leagues.find((l) => l.sportId === sp.si && l.name === name && l.events[0] && l.events[0].S * 1000 >= MIDNIGHT + 86_400_000);
  if (!lg) {
    lg = addLeague(sp, `${name} (suite)`);
    addEvent(lg, null, MIDNIGHT + 30 * 3600_000 + i * 55 * 60_000);
  } else {
    addEvent(lg, null, MIDNIGHT + 30 * 3600_000 + i * 55 * 60_000);
  }
}

/* ── J+2 et J+5 : de quoi tester les fenêtres 3 jours / 7 jours ── */
for (const [offset, count, tag] of [[2, 10, "J+2"], [5, 8, "J+5"]]) {
  for (let i = 0; i < count; i++) {
    const sp = SPORTS[i % 2];
    const name = `${sp.leagues[i % sp.leagues.length]} (${tag})`;
    const lg = leagues.find((l) => l.name === name) ?? addLeague(sp, name);
    addEvent(lg, null, MIDNIGHT + offset * 86_400_000 + (10 + i) * 3600_000);
  }
}

/* ── GetGameZip : tous les marchés, formes réelles (GE par id groupe, E imbriqués, CV string) ── */
function gameZip(ev) {
  const { O1: home, O2: away, SE: sn } = ev;
  const football = sn === "Football";
  const rootE = football
    ? [
        [{ T: 1, C: pickFor(OUT_BAND, ev.I, "1"), CV: null, G: 1 }],
        [{ T: 2, C: pickFor(OUT_BAND, ev.I, "X"), CV: null, G: 1 }],
        [{ T: 3, C: pickFor(OUT_BAND, ev.I, "2"), CV: null, G: 1 }],
      ]
    : [
        [{ T: 401, C: pickFor(OUT_BAND, ev.I, "W1"), G: 1 }],
        [{ T: 402, C: pickFor(OUT_BAND, ev.I, "W2"), G: 1 }],
      ];

  const GE = football
    ? [
        { G: 1, E: rootE },
        {
          G: 8,
          E: [
            [
              { T: 4, C: pickFor(IN_BAND, ev.I, "dc"), CV: String(pickFor(IN_BAND, ev.I, "dc")), G: 8 },
              { T: 5, C: 1.035, CV: "1.035", G: 8 },
              { T: 6, C: 1.045, CV: "1.045", G: 8 },
            ],
          ],
        },
        {
          G: 17,
          E: [
            [
              { T: 9, P: 0.5, C: 0, CV: "1.085", G: 17, N: "Plus de 0,5 but" },
              { T: 9, P: 1.5, C: 1.36, CV: "1.36", G: 17, N: "Plus de 1,5 buts" },
              { T: 9, P: 2.5, C: 1.85, CV: "1.85", G: 17, N: "Plus de 2,5 buts" },
            ],
            [
              { T: 10, P: 7.5, C: 1.008, CV: "1.008", G: 17, N: "Moins de 7,5 buts" },
              { T: 10, P: 8.5, C: 1.001, CV: "1.001", G: 17, N: "Moins de 8,5 buts" },
            ],
          ],
        },
        {
          G: 2,
          E: [
            [
              { T: 7, P: 2, C: 1.06, CV: "1.06", G: 2, N: `${home} (+2)` },
              { T: 7, P: 3, C: 1.017, CV: "1.017", G: 2, N: `${home} (+3)` },
            ],
            [
              { T: 8, P: -2, C: 1.28, CV: "1.28", G: 2, N: `${away} (-2)` },
              // bords de bande : doivent rester DEHORS (1,0069 < 1,007 ; 1,0101 > 1,01)
              { T: 7, P: 4, C: EDGE_OVER, CV: String(EDGE_OVER), G: 2, N: `${home} (+4)` },
              { T: 8, P: -5, C: EDGE_UNDER, CV: String(EDGE_UNDER), G: 2, N: `${away} (-5)` },
            ],
          ],
        },
        {
          G: 19,
          E: [[{ T: 180, C: 1.75, CV: "1.75", G: 19, N: "Oui" }, { T: 181, C: 2.05, CV: "2.05", G: 19, N: "Non" }]],
        },
        {
          G: 15,
          E: [[{ T: 11, P: 0.5, C: 1.42, CV: "1.42", G: 15 }, { T: 12, P: 2.5, C: 1.05, CV: "1.05", G: 15 }]],
        },
        {
          G: 62,
          E: [[{ T: 13, P: 0.5, C: 1.09, CV: "1.09", G: 62 }, { T: 14, P: 4.5, C: 1.01, CV: "1.01", G: 62 }]],
        },
        {
          G: 9999,
          E: [[{ T: 9999, C: 2.2, CV: "2.2", G: 9999, N: "Code inconnu — doit s'afficher" }]],
        },
        {
          G: 500,
          ME: [
            { G: "1 / 1", E: [[{ T: 850, C: 3.2, CV: "3.2", N: `${home} / ${home}` }]] },
            { G: "Nul / Nul", E: [[{ T: 857, C: 5.5, CV: "5.5", N: "Nul / Nul" }]] },
          ],
        },
      ]
    : [
        { G: 1, E: rootE },
        {
          G: 17,
          E: [
            [
              { T: 9, P: 210.5, C: 1.87, CV: "1.87", G: 17, N: "Plus de 210,5" },
              { T: 10, P: 210.5, C: 1.93, CV: "1.93", G: 17, N: "Moins de 210,5" },
            ],
          ],
        },
        {
          G: 2,
          E: [
            [
              { T: 7, P: 4.5, C: 1.72, CV: "1.72", G: 2, N: `${home} (+4,5)` },
              { T: 8, P: -4.5, C: 2.12, CV: "2.12", G: 2, N: `${away} (-4,5)` },
            ],
          ],
        },
      ];

  return {
    Value: {
      I: ev.I,
      O1: home,
      O2: away,
      S: ev.S,
      SE: ev.SE,
      LE: ev.LE,
      WP: { P1: 0.4, PX: 0.2, P2: 0.4 },
      E: rootE,
      GE,
    },
  };
}

const eventById = new Map();
for (const lg of leagues) for (const ev of lg.events) eventById.set(ev.I, ev);

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${PORT}`);

  if (url.pathname === "/__mode") {
    req.socket.server.__down = url.searchParams.get("down") === "1";
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ down: req.socket.server.__down }));
    return;
  }
  if (req.socket.server.__down) {
    res.writeHead(503, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: "feed down (mode test)" }));
    return;
  }

  const send = (code, obj) => {
    res.writeHead(code, { "content-type": "application/json" });
    res.end(JSON.stringify(obj));
  };

  if (url.pathname === "/service-api/LineFeed/Get1x2_VZip") {
    // Gate réelle : ce feed exige l'en-tête x-dt injecté par le service worker du
    // site → 406 pour tout repli serveur. On ne l'utilise plus.
    send(406, {
      type: "feed/NotAcceptableException",
      title: "NotAcceptable",
      status: 406,
      detail: "Error occurred during request execution. Contact the developer.",
    });
    return;
  }

  if (url.pathname === "/service-api/LineFeed/GetSportsZip") {
    const top = url.searchParams.get("top");
    const tree = leagues.map((lg) => ({
      I: lg.sportId,
      N: lg.sportName,
      E: lg.sportName,
      L: [
        {
          L: lg.name,
          LI: lg.li,
          GC: lg.events.length,
        },
      ],
    }));
    // top !== "false" → seules les ligues « à la une » (comportement réel)
    const filtered = top === "false" ? tree : tree.slice(0, 3);
    send(200, { Id: 0, Success: true, Error: "", ErrorCode: 0, Guid: "", Value: filtered });
    return;
  }

  if (url.pathname === "/service-api/LineFeed/GetChampZip") {
    const li = Number(url.searchParams.get("champ"));
    const top = url.searchParams.get("top");
    if (top !== "false") {
      send(200, { Id: 0, Success: true, Value: null }); // filtre « à la une » — comme en vrai
      return;
    }
    const lg = leagues.find((l) => l.li === li);
    send(200, { Id: 0, Success: true, Value: lg ? { G: lg.events } : null });
    return;
  }

  if (url.pathname === "/service-api/LineFeed/GetGameZip") {
    const id = Number(url.searchParams.get("id"));
    if (id % 13 === 0) {
      // panne déterministe : le scraper doit dégrader proprement
      send(500, { error: "boom" });
      return;
    }
    const ev = eventById.get(id);
    if (!ev) {
      send(200, { Id: 0, Success: true, Value: null });
      return;
    }
    send(200, gameZip(ev));
    return;
  }

  send(404, { error: "not found" });
});

server.listen(PORT, "127.0.0.1", () => {
  const today = [...eventById.values()].filter((e) => e.S && e.S * 1000 >= MIDNIGHT && e.S * 1000 < MIDNIGHT + 86_400_000).length;
  const at = (n) =>
    [...eventById.values()].filter(
      (e) => e.S && e.S * 1000 >= MIDNIGHT + n * 86_400_000 && e.S * 1000 < MIDNIGHT + (n + 1) * 86_400_000,
    ).length;
  console.log(
    `mock 1xBet feed sur http://127.0.0.1:${PORT} · ${leagues.length} ligues · ${eventById.size} événements ` +
      `(hier ${at(-1)} · auj. ${today} · demain ${at(1)} · J+2 ${at(2)} · J+5 ${at(5)}) · ` +
      `cotes déterministes (hash de l'id) · Get1x2_VZip=406 · pannes GetGameZip: id%13`,
  );
});
