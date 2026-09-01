import { NextResponse } from "next/server";
import { buildPaniers } from "@/lib/xbet/pack";
import { daysKey, normalizeDays } from "@/lib/xbet/days";
import { getJsonNative, scrapeXbet } from "@/lib/xbet/scrape";
import { writePaniers } from "@/lib/xbet/store";
import { SCAN_DEFAULTS, type ScanParams } from "@/lib/xbet/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request) {
  const { params, days } = await readParams(req);
  const day = daysKey(days);
  // Budget interne : répondre AVANT le timeout client (50 s) et le plafond Vercel (60 s).
  // `days` filtre les candidats sur le(s) jour(s) choisi(s) dans le calendrier.
  const scan = await scrapeXbet(getJsonNative, params, () => undefined, {
    budgetMs: 40_000,
    days,
  });
  if (!scan.ok) {
    return NextResponse.json({
      ok: false,
      fallback: true,
      error: scan.error,
      scan: { host: scan.host, events: scan.events, games: scan.games, pool: 0 },
    });
  }
  const paniers = buildPaniers(scan.legs, params, day);
  let state;
  try {
    state = await writePaniers({
      days,
      host: scan.host,
      pool: scan.legs.length,
      paniers,
      error: null,
    });
  } catch {
    // FS indisponible : on renvoie quand même l'état — le téléphone le garde en localStorage.
    state = {
      day,
      days,
      scannedAt: new Date().toISOString(),
      host: scan.host,
      pool: scan.legs.length,
      paniers,
      error: null,
    };
  }
  return NextResponse.json({
    ok: true,
    fallback: false,
    state,
    scan: { host: scan.host, events: scan.events, games: scan.games, pool: scan.legs.length },
  });
}

async function readParams(req: Request): Promise<{ params: ScanParams; days: string[] }> {
  try {
    const body = (await req.json()) as Partial<ScanParams> & { days?: unknown };
    const params: ScanParams = {
      oddMin: num(body.oddMin, SCAN_DEFAULTS.oddMin),
      oddMax: num(body.oddMax, SCAN_DEFAULTS.oddMax),
      minProduct: Math.max(1.0001, num(body.minProduct, SCAN_DEFAULTS.minProduct)),
      bufferMin: num(body.bufferMin, SCAN_DEFAULTS.bufferMin),
      maxLegs: Math.min(50, Math.max(1, Math.round(num(body.maxLegs, SCAN_DEFAULTS.maxLegs)))),
      maxPaniers: Math.min(8, Math.max(1, Math.round(num(body.maxPaniers, SCAN_DEFAULTS.maxPaniers)))),
    };
    return { params, days: normalizeDays(body.days) };
  } catch {
    return { params: SCAN_DEFAULTS, days: [] };
  }
}

function num(v: unknown, fallback: number) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}
