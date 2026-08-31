#!/usr/bin/env bash
# Test de bout en bout de la ligne du jour NINETY (/journee + /api/xbet/day)
# contre le mock 1xBet (scripts/mock-xbet-feed.mjs).
# Usage: bash scripts/test-day.sh [base_url]   (défaut http://127.0.0.1:3000)
set -u
BASE="${1:-http://127.0.0.1:3000}"
PASS=0
FAIL=0

check() { # nom attendu obtenu
  local name="$1" want="$2" got="$3"
  if [ "$want" = "$got" ]; then PASS=$((PASS+1)); echo "ok   $name ($got)";
  else FAIL=$((FAIL+1)); echo "FAIL $name — attendu $want, obtenu $got"; fi
}

node <<'EOF' > /tmp/days.json
const today = new Date().toISOString().slice(0,10);
const off = (n) => new Date(Date.now() + n*86400000).toISOString().slice(0,10);
console.log(JSON.stringify({ today, tomorrow: off(1), yesterday: off(-1) }));
EOF
TODAY=$(node -e "console.log(require('/tmp/days.json').today)")
TOMORROW=$(node -e "console.log(require('/tmp/days.json').tomorrow)")
YESTERDAY=$(node -e "console.log(require('/tmp/days.json').yesterday)")
echo "── jours: hier=$YESTERDAY aujourd'hui=$TODAY demain=$TOMORROW"

echo "── 1. Page /journee (avant toute donnée : elle doit s'afficher)"
CODE=$(curl -s -o /tmp/journee.html -w "%{http_code}" --max-time 60 "$BASE/journee")
check "GET /journee" 200 "$CODE"
grep -q "La journée" /tmp/journee.html && check "titre présent" yes yes || check "titre présent" yes no

echo "── 2. GET /api/xbet/day?refresh=1 (scrape complet du jour)"
T0=$(date +%s%N)
CODE=$(curl -s -o /tmp/day1.json -w "%{http_code}" --max-time 70 "$BASE/api/xbet/day?day=$TODAY&refresh=1")
T1=$(date +%s%N)
MS=$(( (T1 - T0) / 1000000 ))
check "GET day refresh" 200 "$CODE"
[ "$MS" -lt 60000 ] && check "répond en < 60 s (${MS} ms)" yes yes || check "répond en < 60 s" yes "no(${MS}ms)"

J='const j=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));'
check "ok:true" true "$(node -e "$J console.log(j.ok)" /tmp/day1.json)"
check "cached:false (frais)" false "$(node -e "$J console.log(j.cached)" /tmp/day1.json)"
check "line.day = $TODAY" "$TODAY" "$(node -e "$J console.log(j.line.day)" /tmp/day1.json)"

M=$(node -e "$J console.log(j.line.stats.matches)" /tmp/day1.json)
L=$(node -e "$J console.log(j.line.stats.leagues)" /tmp/day1.json)
MK=$(node -e "$J console.log(j.line.stats.markets)" /tmp/day1.json)
EN=$(node -e "$J console.log(j.line.stats.enriched)" /tmp/day1.json)
echo "   matchs=$M ligues=$L marchés=$MK enrichis=$EN"
[ "$M" -ge 60 ] && check "≥ 60 matchs ($M)" yes yes || check "≥ 60 matchs" yes "no($M)"
[ "$L" -ge 10 ] && check "≥ 10 ligues ($L)" yes yes || check "≥ 10 ligues" yes "no($L)"
[ "$MK" -ge "$((M * 5))" ] && check "≥ 5 marchés/match en moyenne ($MK)" yes yes || check "≥ 5 marchés/match" yes "no($MK/$M)"

echo "── 3. Intégrité des données (tout doit être propre)"
check "tous les coups d'envoi dans le jour" true "$(node -e "$J
const s=Date.parse(j.line.day+'T00:00:00.000Z');
console.log(j.line.leagues.every(l=>l.matches.every(m=>{const t=Date.parse(m.kickoff);return t>=s&&t<s+86400000})))" /tmp/day1.json)"
check "équipes/ligues/sport toujours remplis" true "$(node -e "$J
console.log(j.line.leagues.every(l=>l.league&&l.sport&&l.matches.every(m=>m.home&&m.away&&m.kickoff)))" /tmp/day1.json)"
check "cotes numériques ≥ 1 partout" true "$(node -e "$J
console.log(j.line.leagues.every(l=>l.matches.every(m=>m.markets.every(mk=>mk.selections.every(s=>Number.isFinite(s.odd)&&s.odd>=1&&s.name)))))" /tmp/day1.json)"
check "chaque marché a un nom + ≥ 1 choix" true "$(node -e "$J
console.log(j.line.leagues.every(l=>l.matches.every(m=>m.markets.every(mk=>mk.name&&mk.selections.length>=1))))" /tmp/day1.json)"
check "pas de Home/Away ni de match sans heure" true "$(node -e "$J
console.log(j.line.leagues.every(l=>l.matches.every(m=>!/^(home|away)$/i.test(m.home)&&!/^(home|away)$/i.test(m.away))))" /tmp/day1.json)"
check "au moins un match commencé/à venir cohérent" true "$(node -e "$J
const now=Date.now();
console.log(j.line.leagues.every(l=>l.matches.every(m=>m.started===(Date.parse(m.kickoff)<=now))))" /tmp/day1.json)"
check "football classé en premier" Football "$(node -e "$J console.log(j.line.leagues[0].sport)" /tmp/day1.json)"
check "matchs triés par heure dans chaque ligue" true "$(node -e "$J
console.log(j.line.leagues.every(l=>l.matches.every((m,i)=>i===0||l.matches[i-1].kickoff<=m.kickoff)))" /tmp/day1.json)"
check "aucun doublon d'id de match" true "$(node -e "$J
const ids=j.line.leagues.flatMap(l=>l.matches.map(m=>m.id));console.log(new Set(ids).size===ids.length)" /tmp/day1.json)"

echo "── 4. Tous les marchés présents (groupes nommés, imbrication, codes inconnus, CV)"
check "marchés groupés par nom (Double chance…)" true "$(node -e "$J
const names=new Set(j.line.leagues.flatMap(l=>l.matches.flatMap(m=>m.markets.map(mk=>mk.name))));
console.log(['Double chance','Total buts','Handicap','Score exact','Les deux équipes marquent'].every(n=>names.has(n)))" /tmp/day1.json)"
check "sous-groupes ME parsés (MT/FT)" true "$(node -e "$J
const names=new Set(j.line.leagues.flatMap(l=>l.matches.flatMap(m=>m.markets.map(mk=>mk.name))));
console.log([...names].some(n=>/1 \\/ 1|Nul \\/ Nul/.test(n)))" /tmp/day1.json)"
check "code inconnu (9999) labellisé sans crash" true "$(node -e "$J
const sels=j.line.leagues.flatMap(l=>l.matches.flatMap(m=>m.markets.flatMap(mk=>mk.selections)));
console.log(sels.some(s=>/9999/.test(s.name)||/inconnu/i.test(s.name)))" /tmp/day1.json)"
check "cote CV string lue (Plus de 0,5)" true "$(node -e "$J
const sels=j.line.leagues.flatMap(l=>l.matches.flatMap(m=>m.markets.flatMap(mk=>mk.selections)));
console.log(sels.some(s=>/Plus de 0,5/.test(s.name)&&Math.abs(s.odd-1.085)<1e-9))" /tmp/day1.json)"

echo "── 5. Résilience : GetGameZip en panne (id%13) → cotes de base, jamais de trou"
check "matchs non enrichis présents avec base" true "$(node -e "$J
const all=j.line.leagues.flatMap(l=>l.matches);
const failed=all.filter(m=>m.id%13===0);
console.log(failed.length>0 && failed.every(m=>!m.enriched&&m.marketCount>=1&&m.markets[0].selections.length>=2))" /tmp/day1.json)"
check "partial signalé" true "$(node -e "$J console.log(j.line.partial)" /tmp/day1.json)"

echo "── 6. Filtre par jour (hier / demain)"
CODE=$(curl -s -o /tmp/day2.json -w "%{http_code}" --max-time 70 "$BASE/api/xbet/day?day=$TOMORROW&refresh=1")
check "GET demain" 200 "$CODE"
check "tous les matchs de demain… demain" true "$(node -e "$J
const s=Date.parse('$TOMORROW'+'T00:00:00.000Z');
const ms=j.line.leagues.flatMap(l=>l.matches);
console.log(ms.length>0&&ms.every(m=>Date.parse(m.kickoff)>=s&&Date.parse(m.kickoff)<s+86400000))" /tmp/day2.json)"
CODE=$(curl -s -o /tmp/day3.json -w "%{http_code}" --max-time 70 "$BASE/api/xbet/day?day=$YESTERDAY&refresh=1")
check "GET hier" 200 "$CODE"
check "matchs d'hier… hier" true "$(node -e "$J
const s=Date.parse('$YESTERDAY'+'T00:00:00.000Z');
const ms=j.line.leagues.flatMap(l=>l.matches);
console.log(ms.length>0&&ms.every(m=>Date.parse(m.kickoff)>=s&&Date.parse(m.kickoff)<s+86400000))" /tmp/day3.json)"

echo "── 7. Cache + fraîcheur"
G1=$(node -e "$J console.log(j.line.generatedAt)" /tmp/day1.json)
T0=$(date +%s%N)
CODE=$(curl -s -o /tmp/day4.json -w "%{http_code}" --max-time 10 "$BASE/api/xbet/day?day=$TODAY")
T1=$(date +%s%N); MS=$(( (T1-T0)/1000000 ))
check "2e appel servi du cache" true "$(node -e "$J console.log(j.cached)" /tmp/day4.json)"
[ "$MS" -lt 500 ] && check "cache instantané (${MS} ms)" yes yes || check "cache instantané" yes "no(${MS}ms)"
check "generatedAt identique (pas de re-scrape)" "$G1" "$(node -e "$J console.log(j.line.generatedAt)" /tmp/day4.json)"

echo "── 8. Page détail d'un match (tous les marchés affichés)"
MID=$(node -e "$J console.log(j.line.leagues[0].matches[0].id)" /tmp/day1.json)
CODE=$(curl -s -o /tmp/detail.html -w "%{http_code}" --max-time 30 "$BASE/journee/$MID?day=$TODAY")
check "GET /journee/$MID" 200 "$CODE"
grep -q "Double chance" /tmp/detail.html && check "marchés affichés (Double chance)" yes yes || check "marchés affichés" yes no
CODE=$(curl -s -o /tmp/detail404.html -w "%{http_code}" --max-time 30 "$BASE/journee/999999999")
check "match inconnu → état « introuvable »" yes "$(grep -q "Match introuvable" /tmp/detail404.html && echo yes || echo no)"

echo "── 9. 1xBet tombe en panne → la dernière bonne ligne est conservée"
GEN_BEFORE=$(node -e "$J console.log(j.line.generatedAt)" /tmp/day4.json)
curl -s -o /dev/null "http://127.0.0.1:8787/__mode?down=1"
CODE=$(curl -s -o /tmp/daydown.json -w "%{http_code}" --max-time 70 "$BASE/api/xbet/day?day=$TODAY&refresh=1")
curl -s -o /dev/null "http://127.0.0.1:8787/__mode?down=0"
check "feed down → 200 (cache servi)" 200 "$CODE"
check "ok:true malgré la panne" true "$(node -e "$J console.log(j.ok)" /tmp/daydown.json)"
check "ligne précédente conservée (generatedAt)" "$GEN_BEFORE" "$(node -e "$J console.log(j.line.generatedAt)" /tmp/daydown.json)"
check "avertissement présent" true "$(node -e "$J console.log(Boolean(j.error))" /tmp/daydown.json)"

echo
echo "RÉSULTAT: $PASS ok, $FAIL échec(s)"
[ "$FAIL" -eq 0 ]
