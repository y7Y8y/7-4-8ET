import { NextResponse } from "next/server";
import { scanDayNative } from "@/lib/xbet/day";
import { isFresh, loadDay, saveDay } from "@/lib/xbet/day-store";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Un seul scrape à la fois par jour (double-clic, deux onglets…). */
const inflight = new Map<string, Promise<DayResponse>>();

type DayResponse = {
  ok: boolean;
  cached: boolean;
  line: unknown;
  error?: string | null;
};

function todayUtc() {
  return new Date().toISOString().slice(0, 10);
}

function validDay(day: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(day) && Number.isFinite(Date.parse(`${day}T00:00:00.000Z`));
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  let day = url.searchParams.get("day") ?? todayUtc();
  if (!validDay(day)) day = todayUtc();
  const force = url.searchParams.get("refresh") === "1";

  const cachedLine = await loadDay(day);
  if (!force && isFresh(cachedLine)) {
    return NextResponse.json({ ok: true, cached: true, line: cachedLine });
  }

  // Si un scrape tourne déjà pour ce jour, on attend le même résultat.
  let p = inflight.get(day);
  if (!p) {
    p = build(day).finally(() => inflight.delete(day));
    inflight.set(day, p);
  }
  const res = await p;
  return NextResponse.json(res, { status: res.ok || res.line ? 200 : 502 });
}

async function build(day: string): Promise<DayResponse> {
  let line;
  try {
    line = await scanDayNative({ day, budgetMs: 38_000, maxMatches: 220 });
  } catch {
    line = null; // on garde le cache si présent
  }

  if (!line || !line.stats.matches) {
    // On n'écrase JAMAIS une bonne ligne par un scrape raté.
    const previous = await loadDay(day);
    if (previous?.stats?.matches) {
      return {
        ok: true,
        cached: true,
        line: previous,
        error: line?.error ?? "1xBet injoignable — données précédentes conservées.",
      };
    }
    return {
      ok: false,
      cached: false,
      line: null,
      error: line?.error ?? "1xBet injoignable. Réessaie dans un instant.",
    };
  }

  await saveDay(line);
  return { ok: true, cached: false, line };
}
