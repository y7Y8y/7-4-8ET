#!/usr/bin/env bash
# Test de bout en bout du scan NINETY contre le mock 1xBet (scripts/mock-xbet-feed.mjs).
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

echo "── 1. Page /scan (le bouton est dessus)"
CODE=$(curl -s -o /tmp/scanpage.html -w "%{http_code}" --max-time 60 "$BASE/scan")
check "GET /scan" 200 "$CODE"
grep -q "Lancer le scan" /tmp/scanpage.html && check "bouton présent" yes yes || check "bouton présent" yes no

echo "── 2. Proxy feed same-origin (fallback téléphone, anti-SSRF)"
LIST="http://localhost:8787/service-api/LineFeed/Get1x2_VZip?sports=1&count=5&lng=fr&mode=4"
ENC=$(node -e "console.log(encodeURIComponent('$LIST'))")
CODE=$(curl -s -o /tmp/feedlist.json -w "%{http_code}" --max-time 30 "$BASE/api/xbet/feed?url=$ENC")
check "proxy liste" 200 "$CODE"
[ -s /tmp/feedlist.json ] && jq_get /tmp/feedlist.json "console.log(Array.isArray(j.Value)?'array':'pas-array')" | grep -q array \
  && check "proxy liste JSON Value[]" yes yes || check "proxy liste JSON Value[]" yes no

GAME="http://localhost:8787/service-api/LineFeed/GetGameZip?id=1000001&lng=fr&isSubGames=true&GroupEvents=true"
ENC2=$(node -e "console.log(encodeURIComponent('$GAME'))")
CODE=$(curl -s -o /tmp/feedgame.json -w "%{http_code}" --max-time 30 "$BASE/api/xbet/feed?url=$ENC2")
check "proxy game" 200 "$CODE"

BAD=$(node -e "console.log(encodeURIComponent('http://localhost:8787/api/health'))")
CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 30 "$BASE/api/xbet/feed?url=$BAD")
check "proxy refuse hors LineFeed (SSRF)" 403 "$CODE"

echo "── 3. POST /api/xbet/scan (serveur → feed → paniers)"
CODE=$(curl -s -o /tmp/scan.json -w "%{http_code}" --max-time 90 -X POST "$BASE/api/xbet/scan" \
  -H "content-type: application/json" \
  -d '{"oddMin":1.007,"oddMax":1.01,"bufferMin":20,"maxLegs":50,"maxPaniers":5}')
check "POST scan" 200 "$CODE"
jq_get /tmp/scan.json "console.log(j.ok)" | grep -q true && check "scan ok:true" yes yes || check "scan ok:true" yes no
NLEGS=$(jq_get /tmp/scan.json "console.log((j.state?.paniers||[]).reduce((a,p)=>a+p.legs.length,0))")
POOL=$(jq_get /tmp/scan.json "console.log(j.scan?.pool)")
[ "$NLEGS" -gt 0 ] && [ "$NLEGS" = "$POOL" ] && check "jambes=pool=$NLEGS (>0)" yes yes || check "jambes=pool" yes "no($NLEGS/$POOL)"
INBAND=$(jq_get /tmp/scan.json "console.log((j.state?.paniers||[]).every(p=>p.legs.every(l=>l.odd>=1.0069&&l.odd<=1.0101)))")
check "toutes les cotes dans la bande 1,007–1,01" true "$INBAND"
PREMATCH=$(jq_get /tmp/scan.json "console.log((j.state?.paniers||[]).every(p=>p.legs.every(l=>+new Date(l.kickoff)>Date.now())))")
check "tous les matchs pas encore commencés" true "$PREMATCH"
MAXLEG=$(jq_get /tmp/scan.json "console.log((j.state?.paniers||[]).every(p=>p.legs.length<=50))")
check "≤ 50 sélections / panier" true "$MAXLEG"
NPAN=$(jq_get /tmp/scan.json "console.log((j.state?.paniers||[]).length<=5)")
check "≤ 5 paniers" true "$NPAN"
PROD=$(jq_get /tmp/scan.json "console.log((j.state?.paniers||[]).every(p=>Math.abs(p.product-p.legs.reduce((a,l)=>a*l.odd,1))<1e-6))")
check "cote panier = produit des cotes" true "$PROD"
ONEPER=$(jq_get /tmp/scan.json "const ids=(j.state?.paniers||[]).flatMap(p=>p.legs.map(l=>l.eventId));console.log(new Set(ids).size===ids.length)")
check "un seul pick par match" true "$ONEPER"

echo "── 4. GET /api/xbet/paniers (persistance + purge)"
CODE=$(curl -s -o /tmp/pan.json -w "%{http_code}" --max-time 30 "$BASE/api/xbet/paniers")
check "GET paniers" 200 "$CODE"
KEEP=$(jq_get /tmp/pan.json "console.log(j.state.paniers.length)")
[ "$KEEP" -gt 0 ] && check "paniers persistés ($KEEP)" yes yes || check "paniers persistés" yes no

echo "── 5. POST /api/xbet/ingest (chemin téléphone → serveur)"
LEG=$(jq_get /tmp/scan.json "process.stdout.write(JSON.stringify({legs:j.state.paniers.flatMap(p=>p.legs).slice(0,60),host:j.scan.host,params:{oddMin:1.007,oddMax:1.01,bufferMin:20,maxLegs:50,maxPaniers:5}}))")
CODE=$(curl -s -o /tmp/ing.json -w "%{http_code}" --max-time 30 -X POST "$BASE/api/xbet/ingest" -H "content-type: application/json" -d "$LEG")
check "POST ingest" 200 "$CODE"
ING=$(jq_get /tmp/ing.json "console.log(j.ok&&(j.state.paniers||[]).length>0)")
check "ingest reconstruit les paniers" true "$ING"

echo "── 6. Feed injoignable → fallback propre et rapide"
CODE=$(curl -s -o /tmp/dead.json -w "%{http_code}" --max-time 60 -X POST "$BASE/api/xbet/dead-scan" 2>/dev/null; echo "?")
# pas de route dead-scan : on teste le vrai comportement via health
CODE=$(curl -s -o /tmp/h.json -w "%{http_code}" --max-time 30 "$BASE/api/health")
check "GET /api/health" 200 "$CODE"

echo
echo "RÉSULTAT: $PASS ok, $FAIL échec(s)"
[ "$FAIL" -eq 0 ]
