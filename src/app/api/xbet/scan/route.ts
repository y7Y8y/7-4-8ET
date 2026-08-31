import { NextResponse } from "next/server";
import { buildPaniers } from "@/lib/xbet/pack";
import { getJsonNative, scrapeXbet } from "@/lib/xbet/scrape";
import { writePaniers } from "@/lib/xbet/store";
import { SCAN_DEFAULTS, type ScanParams } from "@/lib/xbet/types";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(req: Request) {
  const params = await readParams(req);
  const scan = await scrapeXbet(getJsonNative, params);
  if (!scan.ok) {
    return NextResponse.json({
      ok: false,
      fallback: true,
      error: scan.error,
      scan: { host: scan.host, events: scan.events, games: scan.games, pool: 0 },
    });
  }
  const paniers = buildPaniers(scan.legs, params);
  const state = await writePaniers({
    host: scan.host,
    pool: scan.legs.length,
    paniers,
    error: null,
  });
  return NextResponse.json({
    ok: true,
    fallback: false,
    state,
    scan: { host: scan.host, events: scan.events, games: scan.games, pool: scan.legs.length },
  });
}

async function readParams(req: Request): Promise<ScanParams> {
  try {
    const body = (await req.json()) as Partial<ScanParams>;
    return {
      oddMin: num(body.oddMin, SCAN_DEFAULTS.oddMin),
      oddMax: num(body.oddMax, SCAN_DEFAULTS.oddMax),
      bufferMin: num(body.bufferMin, SCAN_DEFAULTS.bufferMin),
      maxLegs: Math.min(50, Math.max(1, Math.round(num(body.maxLegs, SCAN_DEFAULTS.maxLegs)))),
      maxPaniers: Math.min(8, Math.max(1, Math.round(num(body.maxPaniers, SCAN_DEFAULTS.maxPaniers)))),
    };
  } catch {
    return SCAN_DEFAULTS;
  }
}

function num(v: unknown, fallback: number) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}
