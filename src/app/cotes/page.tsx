import Link from "next/link";
import { OddsBoard } from "@/components/odds-board";
import { PageHead } from "@/components/shell";
import { X1Ticket } from "@/components/ticket";
import { allMatchesLive, edges } from "@/lib/engine";
import { oddsFr, pct } from "@/lib/format";
import { x1bet } from "@/lib/model";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Cotes 1xBet" };

export default async function OddsPage() {
  const matches = await allMatchesLive();
  const open = matches.filter((m) => m.status !== "finished" && m.odds.length);
  const values = edges();
  return (
    <div>
      <PageHead
        kicker="1xBet · 31 août 2026"
        title="Les vraies cotes. Ton ticket."
        sub="Ligne 1xBet du jour (The Odds API `onexbet` dès qu'elle répond). Tu compares, tu copies, tu saisis dans 1xBet. NINETY ne parie pas à ta place."
      />

      <p className="mb-8 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-xs leading-relaxed text-mist">
        18+. Information, pas un conseil de mise. Une cote n&apos;est pas une garantie. Si tu
        paries sur 1xBet, c&apos;est ton compte, tes règles, tes pertes.
      </p>

      <section className="mb-10">
        <h2 className="mb-4 font-display text-2xl">Tickets du soir</h2>
        <div className="grid gap-3 md:grid-cols-2">
          {open.map((m) => (
            <X1Ticket key={m.id} match={m} />
          ))}
        </div>
      </section>

      {values.length > 0 && (
        <section className="mb-10">
          <h2 className="mb-4 font-display text-2xl">Où 1xBet / le marché est large vs le modèle</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {values.map((v) => {
              const q = x1bet(v.match);
              const xOdd =
                v.side === "home" ? q?.home : v.side === "away" ? q?.away : q?.draw;
              return (
                <Link
                  key={`${v.match.id}-${v.side}`}
                  href={`/matchs/${v.match.id}`}
                  className="rounded-2xl border border-white/8 bg-ink-800/50 p-5 hover:border-lime/40"
                >
                  <div className="flex items-center justify-between text-xs text-mist">
                    <span>{v.match.league.name}</span>
                    <span className="rounded-full bg-lime px-2 py-0.5 font-semibold text-ink-950">
                      +{(v.edge * 100).toFixed(1)}%
                    </span>
                  </div>
                  <p className="mt-2 font-display text-xl">
                    {v.match.home.short} × {v.match.away.short}
                  </p>
                  <p className="mt-1 text-sm">
                    {v.side === "home" ? v.match.home.name : v.side === "away" ? v.match.away.name : "Nul"}{" "}
                    @ {oddsFr(v.odds)} ({v.bookmaker})
                  </p>
                  {xOdd && (
                    <p className="mt-2 text-xs text-lime">1xBet {oddsFr(xOdd)} · modèle {pct(v.modelProb)}</p>
                  )}
                </Link>
              );
            })}
          </div>
        </section>
      )}

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
