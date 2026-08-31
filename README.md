# NINETY

Cockpit football. Live, cotes, pronostics, highlights.

Le dépôt d’origine ne contenait qu’un `.env`. Tout le reste a été écrit de zéro : architecture, modèle, UI, fallback.

## Pourquoi cette structure

Quatre APIs, quatre jobs, un seul domaine.

| Source | Rôle | Quota typique |
| --- | --- | --- |
| **API-Football** | Fixtures, live, compos, stats, prédictions vendor | ~100 req/j (free) |
| **football-data.org** | Calendriers + classements Big 5 | 10 req/min |
| **The Odds API** | Cotes bookmakers EU (1N2, totaux) | ~500 req/mois (free) |
| **Highlightly** | Matchs, clips, prédictions | ~100 req/j (free) |
| **Modèle interne** | Poisson 1N2 + xG + value vs cotes | 0 req |

Les clés restent **côté serveur**. Le client ne parle qu’à NINETY.

## Architecture

```
src/
  app/                 # App Router — pages FR + /api
  components/          # UI (shell, cartes, pitch, cotes)
  lib/
    types.ts           # modèle unique Match / Odds / Prediction
    engine.ts          # façade : hydrate + query
    clock.ts           # minute réelle, MT, FT, score via events
    model.ts           # attaque/défense → Poisson → edge
    providers/         # 4 clients HTTP, timeout 4,5s, cache TTL
    fallback/seed.ts   # saison 2026/27, 31 août, données réelles
```

Flux :

1. Une page demande `engine.allMatches()`.
2. `clock.hydrate()` calcule le statut à l’horloge (pas un JSON figé).
3. Les events dont la minute est dépassée deviennent le score.
4. Si un provider répond, on pourra fusionner. S’il timeout, le seed + le modèle tiennent l’écran.

Caches (mémoire process) :

- live / fixtures : 45s
- cotes : 3 min
- classements : 30 min
- prédictions vendor : 6 h

## Modèle

Chaque club a `att`, `def`, `elo`.

```
xG_home = (att_home / 70) × (70 / def_away) × 1.35 × 1.12
xG_away = (att_away / 70) × (70 / def_home) × 1.35 × 0.92
```

Grille Poisson 0–8 buts → P(1), P(N), P(2).  
Value = `p_modele × cote − 1`. Seuil 4 %.

Ce n’est pas de la magie. C’est un prior, calibré sur la forme 2026/27 + la hiérarchie historique.

## UI

- FR, timezone `Europe/Paris`
- Accueil / Live / Matchs / Cotes / Pronostics / Championnats / Highlights
- Centre match : timeline, xG, stats, compos 4-3-3, tableau de cotes

## Lancer

```bash
cp .env.example .env   # déjà présent ici
npm install
npm run dev            # 0.0.0.0:3000
```

`GET /api/health` ping les 4 providers.  
`GET /api/matches?live=1` renvoie le direct hydraté.

## Données du 31 août 2026

Le seed n’est pas du lorem ipsum. Journée réelle :

- Aston Villa–Arsenal 21h00 Paris
- Barça–Rayo 21h30
- Lecce–Roma, Osasuna–Getafe, Atalanta–Bologna
- Ligue 1 et PL week-end (Man Utd 5-2 Ipswich, Chelsea 4-3 Brighton, City 1er, Hull 2e, PSG 12e à 2 pts…)

## Ce que ce n’est pas

Un bookmaker. Pas de mise, pas de compte, pas de deep-link de pari. Un cockpit d’information.
