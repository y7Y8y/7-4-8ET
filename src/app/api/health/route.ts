import { health } from "@/lib/engine";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const providers = await health();
  return NextResponse.json({
    ok: true,
    time: new Date().toISOString(),
    providers,
    note: "Si les providers sont down depuis ce runtime, NINETY bascule sur le moteur local (seed + Poisson).",
  });
}
