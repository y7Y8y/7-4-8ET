import { NextResponse } from "next/server";
import { normalizeParams } from "@/lib/xbet/params";
import { buildPaniers } from "@/lib/xbet/pack";
import { filterBand } from "@/lib/xbet/parse";
import { writePaniers } from "@/lib/xbet/store";
import { isStrictBand, type ScanParams, type XbetLeg } from "@/lib/xbet/types";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = (await req.json()) as {
    legs?: XbetLeg[];
    host?: string | null;
    params?: Partial<ScanParams>;
    error?: string | null;
  };
  const params = normalizeParams(body.params);
  // Le téléphone n'a pas plus le droit que le serveur d'élargir la bande.
  const legs = filterBand(Array.isArray(body.legs) ? body.legs : [], params);
  const paniers = buildPaniers(legs, params);
  const state = await writePaniers({
    host: body.host ?? null,
    pool: legs.length,
    paniers,
    error: legs.length ? null : (body.error ?? "pool vide"),
  });
  return NextResponse.json({
    ok: legs.length > 0,
    state,
    params,
    strictBand: isStrictBand(params),
  });
}
