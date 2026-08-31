import { NextResponse } from "next/server";
import { buildPaniers } from "@/lib/xbet/pack";
import { writePaniers } from "@/lib/xbet/store";
import { SCAN_DEFAULTS, type ScanParams, type XbetLeg } from "@/lib/xbet/types";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = (await req.json()) as {
    legs?: XbetLeg[];
    host?: string | null;
    params?: Partial<ScanParams>;
    error?: string | null;
  };
  const legs = Array.isArray(body.legs) ? body.legs : [];
  const params: ScanParams = {
    ...SCAN_DEFAULTS,
    ...body.params,
    maxLegs: Math.min(50, body.params?.maxLegs ?? SCAN_DEFAULTS.maxLegs),
  };
  const paniers = buildPaniers(legs, params);
  const state = await writePaniers({
    host: body.host ?? null,
    pool: legs.length,
    paniers,
    error: legs.length ? null : (body.error ?? "pool vide"),
  });
  return NextResponse.json({ ok: legs.length > 0, state });
}
