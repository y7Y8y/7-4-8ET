import { NextResponse } from "next/server";
import { dropPanier, liveState } from "@/lib/xbet/store";

export const dynamic = "force-dynamic";

export async function GET() {
  const state = await liveState();
  return NextResponse.json({ ok: true, state });
}

export async function DELETE(req: Request) {
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ ok: false, error: "id manquant" }, { status: 400 });
  const state = await dropPanier(id);
  return NextResponse.json({ ok: true, state });
}
