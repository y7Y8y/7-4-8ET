# NINETY — paniers 1,01

App téléphone. Un seul écran : paniers + bouton scan.

- Cotes **réelles** 1xBet (pré-match). Hosts : `1xbet.ci`, `1xbet.com`, fallback `linebet.com` (même moteur BetB2B).
- **Un seul écran** : l'accueil = paniers + bouton **Scanner 1xBet** + bouton **Actualiser** (2 onglets : Paniers, Infos).
- Le scan lit **tous les marchés** de chaque match **pas encore commencé** (jamais en live) et en sort la bande **1,007 – 1,01** — une cote par match, la plus proche de 1,01.
- **50 sélections max** / panier (plafond 1xBet). **5 paniers / jour**.
- 50 × 1,01 ≈ **1,64**. Pas de cible 10.
- **Purge** : un match commence → son panier saute (à l'ouverture + bouton Actualiser). Que des matchs pas encore commencés.
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

`POST /api/xbet/scan` lit `LineFeed/Get1x2_VZip` puis `GetGameZip` (les 1,01 sont dans le zip du match, pas dans la liste). Budget interne 40 s, réponse garantie < 60 s (plafond Vercel).

Le feed BetB2B renvoie `406 NotAcceptable` sans les en-têtes `Origin`/`Referer` du skin — ils sont envoyés sur chaque requête (`feedHeaders`).

Si le serveur n’atteint pas 1xBet, le téléphone scanne via le navigateur :

1. fetch direct vers 1xBet (passe si CORS ouvert) ;
2. **proxy same-origin `GET /api/xbet/feed?url=…`** (liste blanche LineFeed uniquement, pas de CORS, sortie par le serveur) ;
3. proxys CORS publics — dernier recours.

L’état est persisté `data/paniers.json` → `/tmp` → mémoire (le FS Vercel est en lecture seule ; chaque appel disque est borné dans le temps), et le téléphone garde sa copie en `localStorage`, qui prime.

`GET /api/xbet/paniers` — état + purge. `POST /api/xbet/ingest` — le téléphone renvoie les jambes trouvées.

## Tests

```bash
node scripts/mock-xbet-feed.mjs &                 # faux feed 1xBet (gate 406, journée complète, pannes simulées)
XBET_FEED_HOSTS=http://localhost:8787 npm run build && npm run start
bash scripts/test-scan.sh http://127.0.0.1:3000   # accueil fusionné, scan, purge des commencés, paniers
bash scripts/test-day.sh  http://127.0.0.1:3000   # moteur journée (données, marchés, cache, pannes)
```
