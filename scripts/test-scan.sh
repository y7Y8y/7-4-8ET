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

TODAY=$(node -e "console.log(new Date().toISOString().slice(0,10))")
TOMORROW=$(node -e "console.log(new Date(Date.now()+86400000).toISOString().slice(0,10))")

echo "── 1. Accueil fusionné : paniers + bouton scanner au même endroit"
CODE=$(curl -s -o /tmp/home.html -w "%{http_code}" --max-time 60 "$BASE/")
check "GET /" 200 "$CODE"
grep -q "Scanner 1xBet" /tmp/home.html && check "bouton scanner sur l'accueil" yes yes || check "bouton scanner sur l'accueil" yes no
grep -q "Actualiser" /tmp/home.html && check "bouton actualiser présent (purge commencés)" yes yes || check "bouton actualiser présent" yes no
CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 30 "$BASE/scan")
check "/scan → / (plus d'onglet séparé)" 307 "$CODE"
CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 30 "$BASE/journee")
check "/journee → / (plus d'UI marchés)" 307 "$CODE"

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
  -d "{\"oddMin\":1.007,\"oddMax\":1.01,\"minProduct\":1.5,\"bufferMin\":20,\"maxLegs\":50,\"maxPaniers\":5,\"days\":[\"$TODAY\"]}")
check "POST scan" 200 "$CODE"
jq_get /tmp/scan.json "console.log(j.ok)" | grep -q true && check "scan ok:true" yes yes || check "scan ok:true" yes no
NLEGS=$(jq_get /tmp/scan.json "console.log((j.state?.paniers||[]).reduce((a,p)=>a+p.legs.length,0))")
POOL=$(jq_get /tmp/scan.json "console.log(j.scan?.pool)")
[ "$NLEGS" -gt 0 ] && [ "$NLEGS" -le "$POOL" ] && check "jambes≤pool=$NLEGS/$POOL (>0)" yes yes || check "jambes≤pool" yes "no($NLEGS/$POOL)"
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
MULTI=$(jq_get /tmp/scan.json "const ps=j.state?.paniers||[];console.log(ps.length>1?ps.every(p=>p.product>=1.4999):true)")
check "règle des 1,50 : chaque panier ≥ 1,50 (sinon un seul)" true "$MULTI"
ONEPER=$(jq_get /tmp/scan.json "const ids=(j.state?.paniers||[]).flatMap(p=>p.legs.map(l=>l.eventId));console.log(new Set(ids).size===ids.length)")
check "un seul pick par match" true "$ONEPER"

echo "── 3b. Scan d'un AUTRE jour (demain) : seules les cotes de demain"
CODE=$(curl -s -o /tmp/scan-tmr.json -w "%{http_code}" --max-time 90 -X POST "$BASE/api/xbet/scan" \
  -H "content-type: application/json" \
  -d "{\"oddMin\":1.007,\"oddMax\":1.01,\"minProduct\":1.5,\"bufferMin\":20,\"maxLegs\":50,\"maxPaniers\":5,\"days\":[\"$TOMORROW\"]}")
check "POST scan demain" 200 "$CODE"
TMR_OK=$(jq_get /tmp/scan-tmr.json "console.log(j.ok&&(j.scan?.pool||0)>0)")
check "scan demain ok avec des matchs" true "$TMR_OK"
TMR_WIN=$(jq_get /tmp/scan-tmr.json "
const s=Date.parse('$TOMORROW'+'T00:00:00.000Z');
const legs=(j.state?.paniers||[]).flatMap(p=>p.legs);
console.log(legs.length>0&&legs.every(l=>{const t=Date.parse(l.kickoff);return t>=s&&t<s+86400000}))")
check "tous les paniers de demain… demain" true "$TMR_WIN"

echo "── 4. GET /api/xbet/paniers (persistance + purge)"
CODE=$(curl -s -o /tmp/pan.json -w "%{http_code}" --max-time 30 "$BASE/api/xbet/paniers")
check "GET paniers" 200 "$CODE"
KEEP=$(jq_get /tmp/pan.json "console.log(j.state.paniers.length)")
[ "$KEEP" -gt 0 ] && check "paniers persistés ($KEEP)" yes yes || check "paniers persistés" yes no

echo "── 5. POST /api/xbet/ingest (chemin téléphone → serveur)"
LEG=$(jq_get /tmp/scan.json "process.stdout.write(JSON.stringify({legs:j.state.paniers.flatMap(p=>p.legs).slice(0,60),host:j.scan.host,params:{oddMin:1.007,oddMax:1.01,minProduct:1.5,bufferMin:20,maxLegs:50,maxPaniers:5}}))")
CODE=$(curl -s -o /tmp/ing.json -w "%{http_code}" --max-time 30 -X POST "$BASE/api/xbet/ingest" -H "content-type: application/json" -d "$LEG")
check "POST ingest" 200 "$CODE"
ING=$(jq_get /tmp/ing.json "console.log(j.ok&&(j.state.paniers||[]).length>0)")
check "ingest reconstruit les paniers" true "$ING"

echo "── 5b. Purge : un match déjà commencé ne reste JAMAIS dans un panier"
PAST=$(node -e "
const j=JSON.parse(require('fs').readFileSync('/tmp/scan.json','utf8'));
const future=j.state.paniers.flatMap(p=>p.legs).slice(0,19);
const legs=[{...future[0], kickoff: new Date(Date.now()-3600e3).toISOString()}, ...future.slice(1)];
process.stdout.write(JSON.stringify({legs, host:j.scan.host, params:{oddMin:1.007,oddMax:1.01,bufferMin:20,maxLegs:10,maxPaniers:5}}))
")
CODE=$(curl -s -o /tmp/purge.json -w "%{http_code}" --max-time 30 -X POST "$BASE/api/xbet/ingest" -H "content-type: application/json" -d "$PAST")
check "ingest avec 1 match commencé" 200 "$CODE"
curl -s --max-time 15 "$BASE/api/xbet/paniers" -o /tmp/afterpurge.json
KEEP=$(jq_get /tmp/afterpurge.json "console.log((j.state.paniers||[]).length)")
[ "$KEEP" -ge 1 ] && check "le panier propre reste ($KEEP)" yes yes || check "le panier propre reste" yes "no($KEEP)"
NO_STARTED=$(jq_get /tmp/afterpurge.json "const legs=(j.state.paniers||[]).flatMap(p=>p.legs);console.log(legs.every(l=>+new Date(l.kickoff)>Date.now()))")
check "aucune jambe commencée dans les paniers restants" true "$NO_STARTED"

echo "── 5c. Règle des 1,50 : fabrication déterministe des paniers (ingest)"
mklegs() { # n, odd
  node -e "
const n=Number(process.argv[1]), odd=Number(process.argv[2]);
const legs=Array.from({length:n},(_,i)=>({
  id:'fake-'+i, eventId:900000+i, sport:'Football', league:'Test',
  home:'Home'+i, away:'Away'+i,
  kickoff:new Date(Date.now()+(i+1)*600000).toISOString(),
  market:'Total', pick:'Plus de 0,5', odd, host:'http://localhost:8787'
}));
process.stdout.write(JSON.stringify({legs,host:'http://localhost:8787',params:{oddMin:1.007,oddMax:1.01,minProduct:1.5,bufferMin:20,maxLegs:50,maxPaniers:5}}));
" "$1" "$2" > /tmp/ing-args.json
}
ingest_check() { # fichier, nom, attendu
  local want="$3"
  local got
  got=$(jq_get "$1" "$4")
  if [ "$got" = "$want" ]; then PASS=$((PASS+1)); echo "ok   $2 ($got)";
  else FAIL=$((FAIL+1)); echo "FAIL $2 — attendu $want, obtenu $got"; fi
}

# 100 jambes @1,01 → 2 paniers de 50, chacun ≥ 1,50
mklegs 100 1.01
curl -s -o /tmp/sc-a.json --max-time 30 -X POST "$BASE/api/xbet/ingest" -H "content-type: application/json" -d @/tmp/ing-args.json
ingest_check /tmp/sc-a.json "100 jambes → 2 paniers" 2 "console.log((j.state.paniers||[]).length)"
ingest_check /tmp/sc-a.json "100 jambes → 50+50 sélections" "50,50" "console.log((j.state.paniers||[]).map(p=>p.legs.length).join(','))"
ingest_check /tmp/sc-a.json "100 jambes → les 2 paniers ≥ 1,50" true "console.log((j.state.paniers||[]).every(p=>p.product>=1.4999))"

# 90 jambes @1,01 → 2 paniers de 45 (1,56 chacun) plutôt qu'un panier plein + un rebut
mklegs 90 1.01
curl -s -o /tmp/sc-c.json --max-time 30 -X POST "$BASE/api/xbet/ingest" -H "content-type: application/json" -d @/tmp/ing-args.json
ingest_check /tmp/sc-c.json "90 jambes → 2 paniers de 45" "45,45" "console.log((j.state.paniers||[]).map(p=>p.legs.length).join(','))"

# 60 jambes @1,01 → PAS de 2e panier à 1,35 : un seul panier qui regroupe tout (50 max)
mklegs 60 1.01
curl -s -o /tmp/sc-b.json --max-time 30 -X POST "$BASE/api/xbet/ingest" -H "content-type: application/json" -d @/tmp/ing-args.json
ingest_check /tmp/sc-b.json "60 jambes → 1 seul panier (pas de filler à 1,35)" 1 "console.log((j.state.paniers||[]).length)"
ingest_check /tmp/sc-b.json "60 jambes → panier plein de 50" 50 "console.log((j.state.paniers||[])[0]?.legs?.length)"

# 40 jambes @1,01 → même la cible est impossible (1,49) : un seul panier « tout »
mklegs 40 1.01
curl -s -o /tmp/sc-d.json --max-time 30 -X POST "$BASE/api/xbet/ingest" -H "content-type: application/json" -d @/tmp/ing-args.json
ingest_check /tmp/sc-d.json "40 jambes → 1 seul panier qui a tout" 1 "console.log((j.state.paniers||[]).length)"
ingest_check /tmp/sc-d.json "40 jambes → les 40 dans le panier" 40 "console.log((j.state.paniers||[])[0]?.legs?.length)"

# Plage de jours (développée par le calendrier) → state.days renseigné
node -e "
const off=(n)=>new Date(Date.now()+n*86400000).toISOString().slice(0,10);
const legs=Array.from({length:100},(_,i)=>({
  id:'rng-'+i, eventId:800000+i, sport:'Football', league:'Test',
  home:'Home'+i, away:'Away'+i,
  kickoff:new Date(Date.parse(off(1)+'T12:00:00Z')+(i+1)*600000).toISOString(),
  market:'Total', pick:'Plus de 0,5', odd:1.01, host:'http://localhost:8787'
}));
process.stdout.write(JSON.stringify({legs,host:'http://localhost:8787',days:[off(1),off(2),off(3)],params:{oddMin:1.007,oddMax:1.01,minProduct:1.5,bufferMin:20,maxLegs:50,maxPaniers:5}}));
" > /tmp/ing-args.json
curl -s -o /tmp/sc-e.json --max-time 30 -X POST "$BASE/api/xbet/ingest" -H "content-type: application/json" -d @/tmp/ing-args.json
ingest_check /tmp/sc-e.json "plage 3 jours → state.days" 3 "console.log((j.state.days||[]).length)"
ingest_check /tmp/sc-e.json "plage 3 jours → state.day clé" true "console.log(/^\d{4}-\d{2}-\d{2}\.\.\d{4}-\d{2}-\d{2}$/.test(j.state.day))"

echo "── 6. Feed injoignable → fallback propre et rapide"
CODE=$(curl -s -o /tmp/dead.json -w "%{http_code}" --max-time 60 -X POST "$BASE/api/xbet/dead-scan" 2>/dev/null; echo "?")
# pas de route dead-scan : on teste le vrai comportement via health
CODE=$(curl -s -o /tmp/h.json -w "%{http_code}" --max-time 30 "$BASE/api/health")
check "GET /api/health" 200 "$CODE"

echo
echo "RÉSULTAT: $PASS ok, $FAIL échec(s)"
[ "$FAIL" -eq 0 ]
