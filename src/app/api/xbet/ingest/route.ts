import { NextResponse } from "next/server";
import { buildPaniers } from "@/lib/xbet/pack";
import { daysKey } from "@/lib/xbet/days";
import { normalizeParams } from "@/lib/xbet/params";
import { writePaniers } from "@/lib/xbet/store";
import { isStrictBand, type XbetLeg } from "@/lib/xbet/types";

export const dynamic = "force-dynamic";

/** Le téléphone renvoie les jambes trouvées → paniers ≥ minProduct + état persisté. */
export async function POST(req: Request) {
  let body: {
    legs?: XbetLeg[];
    host?: string | null;
    params?: Record<string, unknown>;
    days?: unknown;
    error?: string | null;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    body = {};
  }
  const params = normalizeParams(body.params);
  // Le téléphone n'a pas plus le droit que le serveur d'élargir la bande.
  const legs = Array.isArray(body.legs) ? body.legs : [];
  // `days` au niveau du corps gagne, sinon ceux des params, sinon aujourd'hui.
  const explicitDays = normalizeDaysInput(body.days);
  const days = explicitDays.length ? explicitDays : params.days;
  const paniers = buildPaniers(legs, params, daysKey(days));
  const state = await writePaniers({
    days,
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

function normalizeDaysInput(input: unknown): string[] {
  if (Array.isArray(input)) return input.filter((d) => typeof d === "string") as string[];
  if (typeof input === "string" && input) return input.split(",").map((s) => s.trim()).filter(Boolean);
  return [];
}
