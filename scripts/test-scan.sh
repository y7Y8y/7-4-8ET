#!/usr/bin/env bash
# Test de bout en bout du scan NINETY contre le mock 1xBet (scripts/mock-xbet-feed.mjs).
# Accueil (☰ + calendrier), proxy, scan POST/GET, bande STRICTE 1,007–1,01 (jamais
# élargie), règle des 1,50 par panier, purge AU MATCH PRÈS, jours ISO/préréglages, dry.
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
D3=$(node -e "console.log(new Date(Date.now()+2*86400000).toISOString().slice(0,10))")

# Fenêtre de référence des tests. « Aujourd'hui » n'a plus rien à offrir quand la
# journée UTC se termine (buffer de 20 min) — dans ce cas on teste sur 3 jours.
# Forçable : SCAN_DAYS=today bash scripts/test-scan.sh
REMAIN_MIN=$(node -e "const d=new Date();const mid=Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate())+86400000;console.log(Math.floor((mid-Date.now())/60000))")
BASE_DAYS="${SCAN_DAYS:-$( [ "$REMAIN_MIN" -gt 75 ] && echo today || echo 3d )}"
if [ "$BASE_DAYS" = "today" ]; then BASE_DAYS_JSON="[\"$TODAY\"]"; else BASE_DAYS_JSON="[\"$TODAY\",\"$TOMORROW\",\"$D3\"]"; fi
echo "── jours de référence: $BASE_DAYS_JSON (il reste ${REMAIN_MIN} min dans la journée UTC)"

echo "── 1. Accueil fusionné : paniers + scanner + ☰ réglages + calendrier"
CODE=$(curl -s -o /tmp/home.html -w "%{http_code}" --max-time 60 "$BASE/")
check "GET /" 200 "$CODE"
grep -q "Scanner 1xBet" /tmp/home.html && check "bouton scanner sur l'accueil" yes yes || check "bouton scanner sur l'accueil" yes no
grep -q "Actualiser" /tmp/home.html && check "bouton actualiser présent (purge)" yes yes || check "bouton actualiser présent" yes no
grep -q "Règles du scan et réglages" /tmp/home.html && check "☰ réglages en haut à gauche" yes yes || check "☰ réglages en haut à gauche" yes no
grep -q "Choisir le ou les jours du scan" /tmp/home.html && check "calendrier en haut à droite" yes yes || check "calendrier en haut à droite" yes no
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

echo "── 3. POST /api/xbet/scan (serveur → feed → paniers ≥ 1,50)"
CODE=$(curl -s -o /tmp/scan.json -w "%{http_code}" --max-time 90 -X POST "$BASE/api/xbet/scan" \
  -H "content-type: application/json" \
  -d "{\"oddMin\":1.007,\"oddMax\":1.01,\"minProduct\":1.5,\"bufferMin\":20,\"maxLegs\":50,\"maxPaniers\":5,\"days\":$BASE_DAYS_JSON}")
check "POST scan" 200 "$CODE"
jq_get /tmp/scan.json "console.log(j.ok)" | grep -q true && check "scan ok:true" yes yes || check "scan ok:true" yes no
NLEGS=$(jq_get /tmp/scan.json "console.log((j.state?.paniers||[]).reduce((a,p)=>a+p.legs.length,0))")
POOL=$(jq_get /tmp/scan.json "console.log(j.scan?.pool)")
[ "$NLEGS" -gt 0 ] && [ "$NLEGS" -le "$POOL" ] && check "jambes≤pool=$NLEGS/$POOL (>0)" yes yes || check "jambes≤pool" yes "no($NLEGS/$POOL)"
INBAND=$(jq_get /tmp/scan.json "console.log((j.state?.paniers||[]).every(p=>p.legs.every(l=>l.odd>=1.007-1e-9&&l.odd<=1.01+1e-9)))")
check "toutes les cotes dans la bande 1,007–1,01" true "$INBAND"
PREMATCH=$(jq_get /tmp/scan.json "console.log((j.state?.paniers||[]).every(p=>p.legs.every(l=>+new Date(l.kickoff)>Date.now())))")
check "tous les matchs pas encore commencés" true "$PREMATCH"
CAPS=$(jq_get /tmp/scan.json "const ps=j.state?.paniers||[];console.log(ps.length<=5&&ps.every(p=>p.legs.length<=50))")
check "plafonds 1xBet : ≤ 50 sélections / panier, ≤ 5 paniers" true "$CAPS"
PROD=$(jq_get /tmp/scan.json "console.log((j.state?.paniers||[]).every(p=>Math.abs(p.product-p.legs.reduce((a,l)=>a*l.odd,1))<1e-6))")
check "cote panier = produit des cotes" true "$PROD"
MULTI=$(jq_get /tmp/scan.json "const ps=j.state?.paniers||[];console.log(ps.length>1?ps.every(p=>p.product>=1.5-1e-9):true)")
check "règle des 1,50 : chaque panier ≥ 1,50 (sinon un seul)" true "$MULTI"
ONEPER=$(jq_get /tmp/scan.json "const ids=(j.state?.paniers||[]).flatMap(p=>p.legs.map(l=>l.eventId));console.log(new Set(ids).size===ids.length)")
check "un seul pick par match" true "$ONEPER"
ECHO=$(jq_get /tmp/scan.json "console.log(j.params.oddMin===1.007&&j.params.oddMax===1.01&&j.params.minProduct===1.5&&j.strictBand===true&&JSON.stringify(j.window.days)===JSON.stringify($BASE_DAYS_JSON))")
check "paramètres appliqués renvoyés (bande stricte + jours)" true "$ECHO"
STATE_DAYS=$(jq_get /tmp/scan.json "console.log(JSON.stringify(j.state.days)===JSON.stringify($BASE_DAYS_JSON)&&j.state.day===j.window.days.join(j.window.days.length>1?'..':''))")
check "state.days/state.day = jours scannés" true "$STATE_DAYS"

echo "── 3b. POST scan d'un AUTRE jour (demain, dates ISO du calendrier)"
CODE=$(curl -s -o /tmp/scan-tmr.json -w "%{http_code}" --max-time 90 -X POST "$BASE/api/xbet/scan" \
  -H "content-type: application/json" \
  -d "{\"oddMin\":1.007,\"oddMax\":1.01,\"minProduct\":1.5,\"bufferMin\":20,\"maxLegs\":50,\"maxPaniers\":5,\"days\":[\"$TOMORROW\"]}")
check "POST scan demain" 200 "$CODE"
TMR_WIN=$(jq_get /tmp/scan-tmr.json "
const s=Date.parse('$TOMORROW'+'T00:00:00.000Z');
const legs=(j.state?.paniers||[]).flatMap(p=>p.legs);
console.log(legs.length>0&&legs.every(l=>{const t=Date.parse(l.kickoff);return t>=s&&t<s+86400000}))")
check "tous les paniers de demain… demain" true "$TMR_WIN"

echo "── 4. Bande STRICTE : aucun élargissement automatique"
CODE=$(curl -s -o /tmp/narrow.json -w "%{http_code}" --max-time 90 -X POST "$BASE/api/xbet/scan" \
  -H "content-type: application/json" -d "{\"oddMin\":1.009,\"oddMax\":1.0095,\"minProduct\":1.5,\"days\":$BASE_DAYS_JSON}")
NARROW_OK=$(jq_get /tmp/narrow.json "const ls=(j.state?.paniers||[]).flatMap(p=>p.legs);console.log(ls.length>0&&ls.every(l=>l.odd>=1.009-1e-9&&l.odd<=1.0095+1e-9))")
check "bande resserrée (réglages) respectée à la cote près" true "$NARROW_OK"
NPOOL=$(jq_get /tmp/narrow.json "console.log(j.scan?.pool ?? 0)")
[ "$NPOOL" -lt "$POOL" ] && check "bande resserrée → moins de matchs ($NPOOL < $POOL), pas d'élargissement" yes yes \
  || check "bande resserrée → moins de matchs" yes "no($NPOOL/$POOL)"
curl -s -o /tmp/impossible.json --max-time 90 -X POST "$BASE/api/xbet/scan" \
  -H "content-type: application/json" -d "{\"oddMin\":1.0011,\"oddMax\":1.0012,\"minProduct\":1.5,\"days\":$BASE_DAYS_JSON}"
IMP=$(jq_get /tmp/impossible.json "console.log(j.ok===false&&(j.scan?.pool??0)===0&&!(j.state&&j.state.paniers&&j.state.paniers.length))")
check "bande introuvable → 0 jambe (jamais de repli 1,02)" true "$IMP"

echo "── 5. GET /api/xbet/paniers (persistance + purge)"
CODE=$(curl -s -o /tmp/pan.json -w "%{http_code}" --max-time 30 "$BASE/api/xbet/paniers")
check "GET paniers" 200 "$CODE"
KEEP=$(jq_get /tmp/pan.json "console.log(j.state.paniers.length)")
[ "$KEEP" -gt 0 ] && check "paniers persistés ($KEEP)" yes yes || check "paniers persistés" yes no
PURGE=$(jq_get /tmp/pan.json "console.log(typeof j.purge?.legs==='number')")
check "rapport de purge renvoyé" true "$PURGE"

echo "── 6. POST /api/xbet/ingest (chemin téléphone → serveur)"
LEG=$(jq_get /tmp/scan.json "process.stdout.write(JSON.stringify({legs:j.state.paniers.flatMap(p=>p.legs).slice(0,60),host:j.scan.host,params:{oddMin:1.007,oddMax:1.01,minProduct:1.5,bufferMin:20,maxLegs:50,maxPaniers:5},days:j.state.days}))")
CODE=$(curl -s -o /tmp/ing.json -w "%{http_code}" --max-time 30 -X POST "$BASE/api/xbet/ingest" -H "content-type: application/json" -d "$LEG")
check "POST ingest" 200 "$CODE"
ING=$(jq_get /tmp/ing.json "console.log(j.ok&&(j.state.paniers||[]).length>0&&j.strictBand===true)")
check "ingest reconstruit les paniers (écho bande stricte)" true "$ING"

echo "── 7. Purge AU MATCH PRÈS : la jambe saute, le panier reste jouable"
PAST=$(node -e "
const j=JSON.parse(require('fs').readFileSync('/tmp/scan.json','utf8'));
const future=j.state.paniers.flatMap(p=>p.legs).slice(0,100);
while(future.length<100) future.push({...future[future.length%future.length], id:'pad-'+future.length, eventId:600000+future.length});
const legs=[{...future[0], kickoff: new Date(Date.now()-3600e3).toISOString()}, ...future.slice(1)];
process.stdout.write(JSON.stringify({legs, host:j.scan.host, params:{oddMin:1.007,oddMax:1.01,minProduct:1.5,bufferMin:20,maxLegs:50,maxPaniers:5}}))
")
CODE=$(curl -s -o /tmp/purge.json -w "%{http_code}" --max-time 30 -X POST "$BASE/api/xbet/ingest" -H "content-type: application/json" -d "$PAST")
check "ingest 100 jambes dont 1 commencée" 200 "$CODE"
curl -s --max-time 15 "$BASE/api/xbet/paniers" -o /tmp/afterpurge.json
SPLIT=$(jq_get /tmp/afterpurge.json "const ps=j.state.paniers||[];console.log(ps.length===2&&ps.some(p=>p.legs.length===49)&&ps.some(p=>p.legs.length===50))")
check "la jambe commencée part seule, les 49 autres restent (49+50)" true "$SPLIT"
NO_STARTED=$(jq_get /tmp/afterpurge.json "const legs=(j.state.paniers||[]).flatMap(p=>p.legs);console.log(legs.length===99&&legs.every(l=>+new Date(l.kickoff)>Date.now()))")
check "aucune jambe commencée ne survit (99 jambes restantes)" true "$NO_STARTED"
RECOMPUTED=$(jq_get /tmp/afterpurge.json "console.log((j.state.paniers||[]).every(p=>Math.abs(p.product-p.legs.reduce((a,l)=>a*l.odd,1))<1e-9))")
check "cote du panier recalculée sur les jambes restantes" true "$RECOMPUTED"

echo "── 8. GET /api/xbet/scan + jours (préréglages & dates ISO) + dry"
CODE=$(curl -s -o /tmp/get1.json -w "%{http_code}" --max-time 90 "$BASE/api/xbet/scan?days=$BASE_DAYS&minProduct=1.5")
GOK=$(jq_get /tmp/get1.json "console.log(j.ok===true&&(j.scan?.pool??0)>0&&j.params.oddMax===1.01&&j.strictBand===true)")
[ "$CODE" = "200" ] && check "GET /api/xbet/scan (bande stricte par défaut)" true "$GOK" || check "GET /api/xbet/scan" true "http$CODE"
BASE_POOL=$(jq_get /tmp/get1.json "console.log(j.scan.pool)")
curl -s -o /tmp/get0.json --max-time 90 "$BASE/api/xbet/scan?days=today&dry=1"
IN_TODAY=$(jq_get /tmp/get0.json "
const d=new Date();const mid=Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate());
const ls=(j.state?.paniers||[]).flatMap(p=>p.legs);
const allToday=ls.every(l=>{const t=Date.parse(l.kickoff);return t>Date.now()&&t<mid+86400000});
// en toute fin de journée UTC, 'aujourd'hui' peut légitimement être vide
console.log(allToday&&(ls.length>0||$REMAIN_MIN<=75))")
check "days=today → tout se joue aujourd'hui" true "$IN_TODAY"
curl -s -o /tmp/get2.json --max-time 90 "$BASE/api/xbet/scan?days=tomorrow&dry=1"
IN_TOM=$(jq_get /tmp/get2.json "
const d=new Date();const mid=Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate());
const ls=(j.state?.paniers||[]).flatMap(p=>p.legs);
console.log(ls.length>0&&ls.every(l=>{const t=Date.parse(l.kickoff);return t>=mid+86400000&&t<mid+2*86400000}))")
check "days=tomorrow → tout se joue demain" true "$IN_TOM"
curl -s -o /tmp/get2b.json --max-time 90 "$BASE/api/xbet/scan?days=$TOMORROW&dry=1"
IN_TOM_ISO=$(jq_get /tmp/get2b.json "console.log(JSON.stringify(j.window.days)===JSON.stringify(['$TOMORROW']))")
check "days=YYYY-MM-DD (date du calendrier) acceptée en query" true "$IN_TOM_ISO"
curl -s -o /tmp/get3.json --max-time 120 "$BASE/api/xbet/scan?days=7d&dry=1"
WIDE=$(jq_get /tmp/get3.json "
const d=new Date();const mid=Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate());
const ls=(j.state?.paniers||[]).flatMap(p=>p.legs);
const ok=ls.every(l=>{const t=Date.parse(l.kickoff);return t>Date.now()&&t<mid+7*86400000});
console.log(ok&&j.scan.pool>$BASE_POOL&&ls.some(l=>Date.parse(l.kickoff)>mid+86400000))")
check "days=7d → couvre 7 jours et rapporte plus que « $BASE_DAYS » ($BASE_POOL)" true "$WIDE"
DRY=$(jq_get /tmp/get3.json "console.log(j.saved===false&&j.scan.saved===false)")
curl -s --max-time 15 "$BASE/api/xbet/paniers" -o /tmp/afterdry.json
UNTOUCHED=$(jq_get /tmp/afterdry.json "const ls=(j.state.paniers||[]).flatMap(p=>p.legs);console.log(ls.length===$BASE_POOL)")
[ "$DRY" = "true" ] && [ "$UNTOUCHED" = "true" ] && check "dry=1 : scanne sans écraser les paniers enregistrés" true true \
  || check "dry=1 : scanne sans écraser les paniers" true "no(saved=$DRY,paniers=$UNTOUCHED)"

echo "── 9. Règle des 1,50 : fabrication déterministe des paniers (ingest)"
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
ingest_check() { # fichier, nom, attendu, script
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

echo
echo "RÉSULTAT: $PASS ok, $FAIL échec(s)"
[ "$FAIL" -eq 0 ]
