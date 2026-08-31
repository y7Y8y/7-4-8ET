import { NextResponse } from "next/server";
import { FEED_PATHS, feedHeaders, feedHosts } from "@/lib/xbet/hosts";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * Proxy same-origin vers le feed 1xBet (BetB2B). Le navigateur du téléphone
 * l'appelle quand la requête directe est bloquée par CORS : même origine,
 * donc pas de préflight, et c'est le serveur (egress Vercel) qui parle à 1xBet.
 * Liste blanche stricte : seuls les chemins LineFeed connus, hosts connus.
 */
export async function GET(req: Request) {
  const target = new URL(req.url).searchParams.get("url");
  if (!target) return NextResponse.json({ ok: false, error: "url manquant" }, { status: 400 });

  let parsed: URL;
  try {
    parsed = new URL(target);
  } catch {
    return NextResponse.json({ ok: false, error: "url invalide" }, { status: 400 });
  }

  const hostOk = feedHosts().some((h) => new URL(h).origin === parsed.origin);
  const pathOk = FEED_PATHS.some((p) => parsed.pathname === p);
  if (!hostOk || !pathOk) {
    return NextResponse.json({ ok: false, error: "host/chemin non autorisé" }, { status: 403 });
  }

  try {
    const res = await fetch(parsed.toString(), {
      headers: feedHeaders(parsed.origin),
      cache: "no-store",
      signal: AbortSignal.timeout(12_000),
    });
    const text = await res.text();
    return new NextResponse(text, {
      status: res.status,
      headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "proxy échoué" },
      { status: 502 },
    );
  }
}
