# NINETY — paniers 1,01

App téléphone. Tu ouvres, tu vois les paniers 1xBet, tu recopies.

- Cotes **réelles** 1xBet (pré-match). Hosts : `1xbet.ci`, `1xbet.com`, fallback `linebet.com` (même moteur BetB2B).
- Bande **1,007 – 1,01**. Une cote par match, la plus proche de 1,01.
- **50 sélections max** / panier (plafond 1xBet). **5 paniers / jour**.
- 50 × 1,01 ≈ **1,64**. Pas de cible 10.
- Purge auto si un match du panier a commencé.
- **Pas de login 1xBet. Pas de mise auto.** Mise mini = génération de code, à la main.

## Lancer

```bash
npm install
npm run dev    # 0.0.0.0:3000
```

Sur le téléphone : ouvrir l’URL → Accueil = paniers. Ajouter à l’écran d’accueil (PWA).

## Scan

`POST /api/xbet/scan` lit `LineFeed/Get1x2_VZip` puis `GetGameZip` (les 1,01 sont dans le zip du match, pas dans la liste).

Si le serveur n’atteint pas 1xBet, le téléphone scanne via le navigateur.

`GET /api/xbet/paniers` — état + purge.
