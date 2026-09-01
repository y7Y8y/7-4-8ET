import { NextResponse } from "next/server";
import { buildPaniers } from "@/lib/xbet/pack";
import { daysKey } from "@/lib/xbet/days";
import { normalizeParams, paramsFromQuery } from "@/lib/xbet/params";
import { getJsonNative, scrapeXbet } from "@/lib/xbet/scrape";
import { writePaniers } from "@/lib/xbet/store";
import { isStrictBand, type ScanParams, type XbetState } from "@/lib/xbet/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * POST /api/xbet/scan — corps JSON { oddMin, oddMax, minProduct, bufferMin,
 * maxLegs, maxPaniers, days: ["YYYY-MM-DD"… | "today" | "3d" | "all"] }
 * GET  /api/xbet/scan — mêmes paramètres en query (?days=3d&minProduct=1.5&dry=1)
 *
 * `days` = dates ISO du calendrier (1 clic = date, 2 clics = plage), ou
 * préréglage. Chaque panier produit atteint `minProduct` (1,50 par défaut) —
 * sinon un seul panier regroupe tout, jamais de panier « filler ».
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
  const scan = await scrapeXbet(getJsonNative, params, () => undefined, {
    budgetMs: 40_000,
  });
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
      scan: { host: scan.host, events: scan.events, games: scan.games, pool: 0, saved: false },
      state: null,
    });
  }

  const paniers = buildPaniers(scan.legs, params, daysKey(params.days));
  let state: XbetState = {
    day: daysKey(params.days),
    days: params.days,
    scannedAt: new Date().toISOString(),
    host: scan.host,
    pool: scan.legs.length,
    paniers,
    error: null,
  };
  if (save) {
    try {
      state = await writePaniers({
        days: params.days,
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
      saved: meta.saved,
    },
  });
}

async function readParams(req: Request): Promise<ScanParams> {
  try {
    const body = (await req.json()) as Record<string, unknown>;
    return normalizeParams(body);
  } catch {
    return normalizeParams(null);
  }
}
