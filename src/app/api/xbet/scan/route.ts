import { NextResponse } from "next/server";
import { normalizeParams, paramsFromQuery } from "@/lib/xbet/params";
import { buildPaniers } from "@/lib/xbet/pack";
import { getJsonNative, scrapeXbet } from "@/lib/xbet/scrape";
import { writePaniers } from "@/lib/xbet/store";
import { isStrictBand, type Panier, type ScanParams, type XbetState } from "@/lib/xbet/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * POST /api/xbet/scan   — corps JSON { oddMin, oddMax, bufferMin, maxLegs, maxPaniers, days }
 * GET  /api/xbet/scan   — mêmes paramètres en query (?days=3d&oddMax=1.01&dry=1)
 *
 * `dry=1` (ou `save=0`) : scanne et renvoie le résultat SANS toucher aux
 * paniers enregistrés — pratique pour regarder ce que donnerait une autre
 * fenêtre de jours sans casser les paniers du téléphone.
 */
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const params = paramsFromQuery(q);
  const save = q.get("dry") === "1" || q.get("save") === "0" ? false : true;
  return run(params, save);
}

export async function POST(req: Request) {
  const params = await readParams(req);
  return run(params, true);
}

async function run(params: ScanParams, save: boolean) {
  // Budget interne : répondre AVANT le timeout client (50 s) et le plafond Vercel (60 s).
  const scan = await scrapeXbet(getJsonNative, params, () => undefined, { budgetMs: 40_000 });
  const meta = {
    params,
    strictBand: isStrictBand(params),
    window: scan.window,
    saved: false,
  };

  if (!scan.ok) {
    return NextResponse.json({
      ok: false,
      fallback: true,
      error: scan.error,
      ...meta,
      scan: { host: scan.host, events: scan.events, games: scan.games, pool: 0, ...meta },
      state: null,
    });
  }

  const paniers = buildPaniers(scan.legs, params);
  let state: XbetState = {
    day: new Date().toISOString().slice(0, 10),
    scannedAt: new Date().toISOString(),
    host: scan.host,
    pool: scan.legs.length,
    paniers: paniers as Panier[],
    error: null,
  };
  if (save) {
    try {
      state = await writePaniers({
        host: scan.host,
        pool: scan.legs.length,
        paniers,
        error: null,
      });
      meta.saved = true;
    } catch {
      // FS indisponible : on renvoie quand même l'état — le téléphone le garde en localStorage.
    }
  }

  return NextResponse.json({
    ok: true,
    fallback: false,
    state,
    ...meta,
    scan: {
      host: scan.host,
      events: scan.events,
      games: scan.games,
      pool: scan.legs.length,
      ...meta,
    },
  });
}

async function readParams(req: Request): Promise<ScanParams> {
  try {
    const body = (await req.json()) as Partial<ScanParams>;
    return normalizeParams(body);
  } catch {
    return normalizeParams(null);
  }
}
