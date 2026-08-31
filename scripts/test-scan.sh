#!/usr/bin/env bash
# Test de bout en bout du scan NINETY contre le mock 1xBet (scripts/mock-xbet-feed.mjs).
# 35 contrôles : accueil, proxy, scan POST/GET, bande STRICTE 1,007–1,01 (jamais
# élargie), purge AU MATCH PRÈS, fenêtre de jours réglable.
# Usage: bash scripts/test-scan.sh [base_url]   (défaut http://127.0.0.1:3000)
set -u
BASE="${1:-http://127.0.0.1:3000}"
PASS=0
FAIL=0

check() { # nom, attendu, obtenu
  local name="$1" want="$2" got="$3"
  if [ "$want" = "$got" ]; then PASS=$((PASS+1)); echo "ok   $name ($got)";
  else FAIL=$((FAIL+1)); echo "FAIL $name — attendu $want, obtenu $got"; fi
}

jq_get() { node -e "const j=JSON.parse(require('fs').readFileSync('$1','utf8'));$2"; }

echo "── 1. Accueil fusionné : paniers + bouton scanner + fenêtre de jours"
CODE=$(curl -s -o /tmp/home.html -w "%{http_code}" --max-time 60 "$BASE/")
check "GET /" 200 "$CODE"
grep -q "Scanner 1xBet" /tmp/home.html && check "bouton scanner sur l'accueil" yes yes || check "bouton scanner sur l'accueil" yes no
grep -q "Actualiser" /tmp/home.html && check "bouton actualiser présent (purge)" yes yes || check "bouton actualiser présent" yes no
grep -q "Fenêtre de jours" /tmp/home.html && grep -q "3 jours" /tmp/home.html \
  && check "sélecteur de fenêtre de jours sur l'accueil" yes yes || check "sélecteur de fenêtre de jours" yes no
CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 30 "$BASE/scan")
check "/scan → / (plus d'onglet séparé)" 307 "$CODE"

echo "── 2. Proxy feed same-origin (fallback téléphone, anti-SSRF)"
LIST="http://localhost:8787/service-api/LineFeed/GetSportsZip?top=false"
ENC=$(node -e "console.log(encodeURIComponent('$LIST'))")
CODE=$(curl -s -o /tmp/feedlist.json -w "%{http_code}" --max-time 30 "$BASE/api/xbet/feed?url=$ENC")
check "proxy arbre sports" 200 "$CODE"
[ -s /tmp/feedlist.json ] && node -e "const j=JSON.parse(require('fs').readFileSync('/tmp/feedlist.json','utf8'));console.log(Array.isArray(j.Value)?'array':'pas-array')" | grep -q array \
  && check "proxy arbre JSON Value[]" yes yes || check "proxy arbre JSON Value[]" yes no

GAME="http://localhost:8787/service-api/LineFeed/GetGameZip?id=1000001&isNewBuilder=true&GroupEvents=true&marketType=1&countevents=250"
ENC2=$(node -e "console.log(encodeURIComponent('$GAME'))")
CODE=$(curl -s -o /tmp/feedgame.json -w "%{http_code}" --max-time 30 "$BASE/api/xbet/feed?url=$ENC2")
check "proxy game" 200 "$CODE"

GATED=$(node -e "console.log(encodeURIComponent('http://localhost:8787/service-api/LineFeed/Get1x2_VZip?sports=1&count=3'))")
CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 30 "$BASE/api/xbet/feed?url=$GATED")
check "proxy refuse le feed verrouillé (Get1x2_VZip)" 403 "$CODE"

BAD=$(node -e "console.log(encodeURIComponent('http://localhost:8787/api/health'))")
CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 30 "$BASE/api/xbet/feed?url=$BAD")
check "proxy refuse hors LineFeed (SSRF)" 403 "$CODE"

echo "── 3. POST /api/xbet/scan (serveur → feed → paniers)"
CODE=$(curl -s -o /tmp/scan.json -w "%{http_code}" --max-time 90 -X POST "$BASE/api/xbet/scan" \
  -H "content-type: application/json" \
  -d '{"oddMin":1.007,"oddMax":1.01,"bufferMin":20,"maxLegs":50,"maxPaniers":5,"days":"today"}')
check "POST scan" 200 "$CODE"
jq_get /tmp/scan.json "console.log(j.ok)" | grep -q true && check "scan ok:true" yes yes || check "scan ok:true" yes no
NLEGS=$(jq_get /tmp/scan.json "console.log((j.state?.paniers||[]).reduce((a,p)=>a+p.legs.length,0))")
POOL=$(jq_get /tmp/scan.json "console.log(j.scan?.pool)")
[ "$NLEGS" -gt 0 ] && [ "$NLEGS" = "$POOL" ] && check "jambes=pool=$NLEGS (>0)" yes yes || check "jambes=pool" yes "no($NLEGS/$POOL)"
INBAND=$(jq_get /tmp/scan.json "console.log((j.state?.paniers||[]).every(p=>p.legs.every(l=>l.odd>=1.007-1e-9&&l.odd<=1.01+1e-9)))")
check "toutes les cotes dans la bande 1,007–1,01" true "$INBAND"
PREMATCH=$(jq_get /tmp/scan.json "console.log((j.state?.paniers||[]).every(p=>p.legs.every(l=>+new Date(l.kickoff)>Date.now())))")
check "tous les matchs pas encore commencés" true "$PREMATCH"
CAPS=$(jq_get /tmp/scan.json "const ps=j.state?.paniers||[];console.log(ps.length<=5&&ps.every(p=>p.legs.length<=50))")
check "plafonds 1xBet : ≤ 50 sélections / panier, ≤ 5 paniers" true "$CAPS"
PROD=$(jq_get /tmp/scan.json "console.log((j.state?.paniers||[]).every(p=>Math.abs(p.product-p.legs.reduce((a,l)=>a*l.odd,1))<1e-6))")
check "cote panier = produit des cotes" true "$PROD"
ONEPER=$(jq_get /tmp/scan.json "const ids=(j.state?.paniers||[]).flatMap(p=>p.legs.map(l=>l.eventId));console.log(new Set(ids).size===ids.length)")
check "un seul pick par match" true "$ONEPER"
ECHO=$(jq_get /tmp/scan.json "console.log(j.params.oddMin===1.007&&j.params.oddMax===1.01&&j.strictBand===true&&j.window.days==='today')")
check "paramètres appliqués renvoyés (bande stricte + fenêtre)" true "$ECHO"

echo "── 4. Bande STRICTE : aucun élargissement automatique"
CODE=$(curl -s -o /tmp/narrow.json -w "%{http_code}" --max-time 90 -X POST "$BASE/api/xbet/scan" \
  -H "content-type: application/json" -d '{"oddMin":1.009,"oddMax":1.0095,"days":"today"}')
NARROW_OK=$(jq_get /tmp/narrow.json "const ls=(j.state?.paniers||[]).flatMap(p=>p.legs);console.log(ls.length>0&&ls.every(l=>l.odd>=1.009-1e-9&&l.odd<=1.0095+1e-9))")
check "bande resserrée (réglages) respectée à la cote près" true "$NARROW_OK"
NPOOL=$(jq_get /tmp/narrow.json "console.log(j.scan?.pool ?? 0)")
[ "$NPOOL" -lt "$POOL" ] && check "bande resserrée → moins de matchs ($NPOOL < $POOL), pas d'élargissement" yes yes \
  || check "bande resserrée → moins de matchs" yes "no($NPOOL/$POOL)"
curl -s -o /tmp/impossible.json --max-time 90 -X POST "$BASE/api/xbet/scan" \
  -H "content-type: application/json" -d '{"oddMin":1.0011,"oddMax":1.0012,"days":"today"}'
IMP=$(jq_get /tmp/impossible.json "console.log(j.ok===false&&(j.scan?.pool??0)===0&&!(j.state&&j.state.paniers&&j.state.paniers.length))")
check "bande introuvable → 0 jambe (jamais de repli 1,02)" true "$IMP"

echo "── 5. GET /api/xbet/paniers (persistance + purge)"
CODE=$(curl -s -o /tmp/pan.json -w "%{http_code}" --max-time 30 "$BASE/api/xbet/paniers")
check "GET paniers" 200 "$CODE"
KEEP=$(jq_get /tmp/pan.json "console.log(j.state.paniers.length)")
[ "$KEEP" -gt 0 ] && check "paniers persistés ($KEEP)" yes yes || check "paniers persistés" yes no

echo "── 6. POST /api/xbet/ingest (chemin téléphone → serveur)"
LEG=$(jq_get /tmp/scan.json "process.stdout.write(JSON.stringify({legs:j.state.paniers.flatMap(p=>p.legs).slice(0,60),host:j.scan.host,params:{oddMin:1.007,oddMax:1.01,bufferMin:20,maxLegs:50,maxPaniers:5}}))")
CODE=$(curl -s -o /tmp/ing.json -w "%{http_code}" --max-time 30 -X POST "$BASE/api/xbet/ingest" -H "content-type: application/json" -d "$LEG")
check "POST ingest" 200 "$CODE"
ING=$(jq_get /tmp/ing.json "console.log(j.ok&&(j.state.paniers||[]).length>0)")
check "ingest reconstruit les paniers" true "$ING"

echo "── 7. Purge AU MATCH PRÈS : la jambe saute, le panier reste jouable"
PAST=$(node -e "
const j=JSON.parse(require('fs').readFileSync('/tmp/scan.json','utf8'));
const future=j.state.paniers.flatMap(p=>p.legs).slice(0,19);
const legs=[{...future[0], kickoff: new Date(Date.now()-3600e3).toISOString()}, ...future.slice(1)];
process.stdout.write(JSON.stringify({legs, host:j.scan.host, params:{oddMin:1.007,oddMax:1.01,bufferMin:20,maxLegs:10,maxPaniers:5}}))
")
CODE=$(curl -s -o /tmp/purge.json -w "%{http_code}" --max-time 30 -X POST "$BASE/api/xbet/ingest" -H "content-type: application/json" -d "$PAST")
check "ingest avec 1 match commencé (19 jambes, 10/panier)" 200 "$CODE"
curl -s --max-time 15 "$BASE/api/xbet/paniers" -o /tmp/afterpurge.json
SPLIT=$(jq_get /tmp/afterpurge.json "const ps=j.state.paniers||[];console.log(ps.length===2&&ps[0].legs.length===9&&ps[1].legs.length===9)")
check "le match commencé part seul, les 9 autres restent (9+9)" true "$SPLIT"
NO_STARTED=$(jq_get /tmp/afterpurge.json "const legs=(j.state.paniers||[]).flatMap(p=>p.legs);console.log(legs.length===18&&legs.every(l=>+new Date(l.kickoff)>Date.now()))")
check "aucune jambe commencée ne survit (18 jambes restantes)" true "$NO_STARTED"
RECOMPUTED=$(jq_get /tmp/afterpurge.json "console.log((j.state.paniers||[]).every(p=>Math.abs(p.product-p.legs.reduce((a,l)=>a*l.odd,1))<1e-9))")
check "cote du panier recalculée sur les jambes restantes" true "$RECOMPUTED"

echo "── 8. GET /api/xbet/scan + fenêtre de jours (Aujourd'hui / Demain / 3 j / 7 j / Tous)"
CODE=$(curl -s -o /tmp/get1.json -w "%{http_code}" --max-time 90 "$BASE/api/xbet/scan?days=today")
GOK=$(jq_get /tmp/get1.json "console.log(j.ok===true&&(j.scan?.pool??0)>0&&j.window.days==='today'&&j.params.oddMax===1.01)")
[ "$CODE" = "200" ] && check "GET /api/xbet/scan (bande stricte par défaut)" true "$GOK" || check "GET /api/xbet/scan" true "http$CODE"
TODAY_POOL=$(jq_get /tmp/get1.json "console.log(j.scan.pool)")
IN_TODAY=$(jq_get /tmp/get1.json "
const d=new Date();const mid=Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate());
const ls=j.state.paniers.flatMap(p=>p.legs);
console.log(ls.length>0&&ls.every(l=>{const t=Date.parse(l.kickoff);return t>Date.now()&&t<mid+86400000}))")
check "days=today → tout se joue aujourd'hui" true "$IN_TODAY"
curl -s -o /tmp/get2.json --max-time 90 "$BASE/api/xbet/scan?days=tomorrow&dry=1"
IN_TOM=$(jq_get /tmp/get2.json "
const d=new Date();const mid=Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate());
const ls=(j.state?.paniers||[]).flatMap(p=>p.legs);
console.log(ls.length>0&&ls.every(l=>{const t=Date.parse(l.kickoff);return t>=mid+86400000&&t<mid+2*86400000}))")
check "days=tomorrow → tout se joue demain" true "$IN_TOM"
curl -s -o /tmp/get3.json --max-time 120 "$BASE/api/xbet/scan?days=7d&dry=1"
WIDE=$(jq_get /tmp/get3.json "
const d=new Date();const mid=Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate());
const ls=(j.state?.paniers||[]).flatMap(p=>p.legs);
const ok=ls.every(l=>{const t=Date.parse(l.kickoff);return t>Date.now()&&t<mid+7*86400000});
console.log(ok&&j.scan.pool>$TODAY_POOL&&ls.some(l=>Date.parse(l.kickoff)>mid+86400000))")
check "days=7d → couvre 7 jours et rapporte plus que today ($TODAY_POOL)" true "$WIDE"
DRY=$(jq_get /tmp/get3.json "console.log(j.saved===false&&j.scan.saved===false)")
curl -s --max-time 15 "$BASE/api/xbet/paniers" -o /tmp/afterdry.json
UNTOUCHED=$(jq_get /tmp/afterdry.json "const ls=(j.state.paniers||[]).flatMap(p=>p.legs);console.log(ls.length===$TODAY_POOL)")
[ "$DRY" = "true" ] && [ "$UNTOUCHED" = "true" ] && check "dry=1 : scanne sans écraser les paniers enregistrés" true true \
  || check "dry=1 : scanne sans écraser les paniers" true "no(saved=$DRY,paniers=$UNTOUCHED)"

echo
echo "RÉSULTAT: $PASS ok, $FAIL échec(s)"
[ "$FAIL" -eq 0 ]
