import { allMatches, liveMatches, matchesOn } from "@/lib/engine";
import { ymd } from "@/lib/format";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const live = url.searchParams.get("live");
  const day = url.searchParams.get("date") ?? ymd();
  const data = live === "1" ? liveMatches() : matchesOn(day);
  return NextResponse.json({ day, count: data.length, matches: data, all: live === "all" ? allMatches() : undefined });
}
