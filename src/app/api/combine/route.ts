import { NextResponse } from "next/server";
import { buildBaskets } from "@/lib/combine/pack";
import { parseParams, scanCombine } from "@/lib/combine/scan";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const demo = url.searchParams.get("demo") === "1";
  const params = parseParams({
    oddMin: num(url.searchParams.get("oddMin")),
    oddMax: num(url.searchParams.get("oddMax")),
    target: num(url.searchParams.get("target")),
    fallback: num(url.searchParams.get("fallback")),
    bufferMin: num(url.searchParams.get("bufferMin")),
    minStake: num(url.searchParams.get("minStake")),
  });
  const scan = await scanCombine(params, demo);
  const baskets = buildBaskets(scan.legs, params);
  return NextResponse.json({
    ok: true,
    owner: true,
    note: "Pré-match 1xBet uniquement. Aucun pari n'est placé. Mise mini = génération de code, à la main.",
    scan: {
      scannedAt: scan.scannedAt,
      source: scan.source,
      pool: scan.legs.length,
      liveRejected: scan.liveRejected,
      outOfRange: scan.outOfRange,
    },
    params,
    pool: baskets.filtered.length,
    primary: slim(baskets.primary),
    fallback: slim(baskets.fallback),
    legs: baskets.filtered,
  });
}

function slim(b: ReturnType<typeof buildBaskets>["primary"]) {
  return {
    target: b.target,
    ok: b.ok,
    product: b.product,
    count: b.legs.length,
    missingFactor: b.missingFactor,
    needed: b.needed,
    legs: b.legs,
  };
}

function num(v: string | null) {
  if (v == null || v === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}
