import Link from "next/link";
import { OddsBoard } from "@/components/odds-board";
import { PageHead } from "@/components/shell";
import { allMatches, edges } from "@/lib/engine";
import { oddsFr, pct } from "@/lib/format";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Cotes" };

export default function OddsPage() {
  const open = allMatches().filter((m) => m.status !== "finished" && m.odds.length);
  const values = edges();
  return (
    <div>
      <PageHead
        kicker="Marché"
        title="Les cotes, alignées."
        sub="Comparateur 1N2 (Winamax, Betclic, Unibet, Pinnacle, Bet365) + edge contre le modèle Poisson interne. The Odds API prend le relais dès qu'elle répond."
      />

      <section className="mb-10">
        <h2 className="mb-4 font-display text-2xl">Value bets</h2>
        <div className="grid gap-3 md:grid-cols-2">
          {values.map((v) => (
            <Link
              key={`${v.match.id}-${v.side}`}
              href={`/matchs/${v.match.id}`}
              className="rounded-2xl border border-white/8 bg-ink-800/50 p-5 hover:border-lime/40"
            >
              <div className="flex items-center justify-between text-xs text-mist">
                <span>{v.match.league.name}</span>
                <span className="rounded-full bg-lime px-2 py-0.5 font-semibold text-ink-950">
                  +{(v.edge * 100).toFixed(1)}% edge
                </span>
              </div>
              <p className="mt-2 font-display text-xl">
                {v.match.home.short} × {v.match.away.short}
              </p>
              <p className="mt-1 text-sm">
                Parier{" "}
                <span className="text-lime">
                  {v.side === "home" ? v.match.home.name : v.side === "away" ? v.match.away.name : "nul"}
                </span>{" "}
                @ {oddsFr(v.odds)} ({v.bookmaker})
              </p>
              <p className="mt-2 text-xs text-mist">
                Implied {pct(v.implied)} · modèle {pct(v.modelProb)}
              </p>
            </Link>
          ))}
        </div>
      </section>

      <div className="space-y-8">
        {open.map((m) => (
          <section key={m.id}>
            <div className="mb-3 flex items-end justify-between">
              <div>
                <p className="text-[10px] uppercase tracking-[0.2em] text-mist">{m.league.name}</p>
                <h3 className="font-display text-xl">
                  {m.home.name} × {m.away.name}
                </h3>
              </div>
              <Link href={`/matchs/${m.id}`} className="text-xs text-lime">
                Fiche
              </Link>
            </div>
            <OddsBoard match={m} />
          </section>
        ))}
      </div>
    </div>
  );
}
