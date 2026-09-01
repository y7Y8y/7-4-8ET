# NINETY — paniers 1,01

App téléphone. Un seul écran : paniers + bouton scan.

- Cotes **réelles** 1xBet (pré-match). Hosts : `1xbet.ci`, `1xbet.com`, fallback `linebet.com` (même moteur BetB2B).
- **Un seul écran** : l'accueil = paniers + bouton **Scanner 1xBet** + bouton **Actualiser** (2 onglets : Paniers, Infos).
- **Calendrier en haut à droite** : icône → 1 clic = une date, 2 clics = une plage (jusqu'à 14 jours). Le scan ne lit que les matchs du ou des jours choisis (plus seulement aujourd'hui).
- **☰ en haut à gauche** : règles du scan + tous les réglages (bande de cotes, cote totale min, sélections/panier, paniers max, buffer) — l'onglet Paniers reste épuré.
- Le scan lit **tous les marchés** de chaque match **pas encore commencé** (jamais en live) et en sort la bande **1,007 – 1,01** — une cote par match, la plus proche de 1,01.
- **Chaque panier atteint la cote totale minimale** (`minProduct`, **1,50** par défaut) : on crée le plus grand nombre de paniers dont CHACUN atteint la cible ; ce qui reste ne suffit pas → **un seul panier regroupe tout** (meilleures cotes, plafond 50). Jamais de panier « filler » à 1,05.
- **50 sélections max** / panier (plafond 1xBet). **5 paniers max** / scan (réglable 1–8).
- 50 × 1,01 ≈ **1,64**. Pas de cible 10.
- **Purge** : un match commence → son panier saute (à l'ouverture + bouton Actualiser). Que des matchs pas encore commencés. Les paniers des autres jours choisis restent visibles tant qu'ils n'ont pas commencé.
- **Pas de login 1xBet. Pas de mise auto.** Mise mini = génération de code, à la main.

## Lancer

```bash
npm install
npm run dev    # 0.0.0.0:3000
```

Sur le téléphone : ouvrir l’URL → Accueil = paniers. Ajouter à l’écran d’accueil (PWA).

## Journée (moteur interne, pas d'UI)

Le scan doit couvrir **toutes les ligues qui jouent le jour désigné** : `GET /api/xbet/day?day=YYYY-MM-DD` (& `&refresh=1`) fait la liste complète par sport puis enrichit chaque match avec **tous ses marchés** (groupes nommés, sous-groupes, codes inconnus, cotes `CV` string). Cette mécanique alimente la détection de bande — elle n'est plus affichée dans l'app (l'UI « tous les marchés » a été retirée : le scan lit tout, l'utilisateur ne voit que les paniers).

Robustesse : budget temps global (38 s, réponse < 60 s), un zip en échec → cotes de base (`partial: true`), cache 3 min, **un scrape raté n'écrase jamais la dernière bonne ligne**, un seul scrape simultané par jour.

## Scan

Le scan utilise uniquement les endpoints **non verrouillés** du feed BetB2B — vérifiés sur le vrai `1xbet.ci` :

1. `GetSportsZip?top=false` → toutes les ligues qui jouent (tous sports) ;
2. `GetChampZip?champ=<ligue>&top=false` → les matchs de chaque ligue (équipes, heures) — filtrés sur la ou les fenêtres UTC des **jours choisis** au calendrier (`days` dans `POST /api/xbet/scan`) ;
3. `GetGameZip?id=<match>&isNewBuilder=true…` → **tous les marchés** du match → on garde la bande 1,007–1,01 (une cote par match, la plus proche de 1,01), uniquement sur des matchs **pas encore commencés** (buffer 20 min, jamais de live).

`POST /api/xbet/scan` accepte `days: ["YYYY-MM-DD", …]` (1 à 14 jours, plage développée par le calendrier). Sans `days` → comportement historique (tout pré-match). La découpe des paniers (`buildPaniers`) applique la règle du `minProduct`.

`Get1x2_VZip` est **verrouillé** (406 : exige l'en-tête `x-dt` injecté par le service worker du site — impossible à rejouer côté serveur). On ne l'utilise plus.

Budget interne 40 s, réponse garantie < 60 s (plafond Vercel). Si le serveur n'atteint pas 1xBet, le téléphone scanne via le navigateur : fetch direct → proxy same-origin `GET /api/xbet/feed?url=…` (liste blanche LineFeed ouverts) → proxys publics en dernier recours.

L'état est persisté `data/paniers.json` → `/tmp` → mémoire (FS Vercel en lecture seule ; chaque appel disque est borné dans le temps), et le téléphone garde sa copie en `localStorage`, qui prime.

`GET /api/xbet/paniers` — état + purge. `POST /api/xbet/ingest` — le téléphone renvoie les jambes trouvées.

## Tests

```bash
node scripts/mock-xbet-feed.mjs &                 # faux feed 1xBet (gate 406, journée complète, pannes simulées)
XBET_FEED_HOSTS=http://localhost:8787 npm run build && npm run start
bash scripts/test-scan.sh http://127.0.0.1:3000   # accueil fusionné, scan, purge des commencés, paniers
bash scripts/test-day.sh  http://127.0.0.1:3000   # moteur journée (données, marchés, cache, pannes)
```
