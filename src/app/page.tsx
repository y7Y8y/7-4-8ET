import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Crest } from "@/components/crest";
import { MatchCard, MatchRow } from "@/components/match-card";
import { StatusChip } from "@/components/live-clock";
import { Ticker } from "@/components/ticker";
import { X1Ticket } from "@/components/ticket";
import { allMatches, edges, featuredMatch, liveMatches, matchesOn } from "@/lib/engine";
import { fmtTime, oddsFr, pct, ymd } from "@/lib/format";
import { x1bet } from "@/lib/model";

export const dynamic = "force-dynamic";

export default function HomePage() {
  const featured = featuredMatch();
  const live = liveMatches();
  const today = matchesOn(ymd());
  const recent = allMatches()
    .filter((m) => m.status === "finished")
    .slice()
    .sort((a, b) => +new Date(b.kickoff) - +new Date(a.kickoff))
    .slice(0, 6);
  const values = edges().slice(0, 3);
  const hero =
    featured.id === "barca-rayo" ? "/hero-camp-nou.jpg" : "/hero-villa.jpg";

  return (
    <div className="space-y-10">
      <Ticker matches={allMatches()} />

      <section className="relative overflow-hidden rounded-[28px] border border-white/10">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={hero} alt="" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-r from-ink-950 via-ink-950/80 to-ink-950/20" />
        <div className="relative grid gap-8 p-6 md:grid-cols-[1.2fr_.8fr] md:p-10">
          <div>
            <p className="text-[11px] uppercase tracking-[0.28em] text-lime">Match de la nuit</p>
            <div className="mt-3 flex items-center gap-3">
              <StatusChip status={featured.status} />
              <span className="text-xs uppercase tracking-[0.18em] text-mist">
                {featured.league.name} · {featured.venue}
              </span>
            </div>
            <h1 className="mt-5 font-display text-4xl font-semibold leading-[0.95] tracking-tight md:text-6xl">
              {featured.home.name}
              <span className="mx-3 text-lime">×</span>
              {featured.away.name}
            </h1>
            <div className="mt-6 flex items-end gap-6">
              <Crest team={featured.home} size={48} />
              <p className="font-score text-6xl tabular leading-none text-lime md:text-7xl">
                {featured.score.home ?? "–"}
                <span className="mx-2 text-paper/40">:</span>
                {featured.score.away ?? "–"}
              </p>
              <Crest team={featured.away} size={48} />
            </div>
            <p className="mt-4 text-sm text-mist">
              Coup d&apos;envoi {fmtTime(featured.kickoff)} · Paris
              {featured.prediction
                ? ` · Modèle ${pct(Math.max(featured.prediction.home, featured.prediction.draw, featured.prediction.away))} ${
                    featured.prediction.pick === "home"
                      ? featured.home.short
                      : featured.prediction.pick === "away"
                        ? featured.away.short
                        : "NUL"
                  }`
                : ""}
            </p>
            <Link
              href={`/matchs/${featured.id}`}
              className="mt-6 inline-flex items-center gap-2 rounded-full bg-lime px-5 py-2.5 text-sm font-semibold text-ink-950"
            >
              Ouvrir le centre match <ArrowUpRight size={16} />
            </Link>
          </div>
          <div className="grid content-end gap-3">
            {x1bet(featured) ? (
              <X1Ticket match={featured} />
            ) : featured.odds[0] ? (
              <div className="rounded-2xl border border-white/10 bg-ink-950/70 p-4 backdrop-blur">
                <p className="text-[10px] uppercase tracking-[0.2em] text-mist">1N2</p>
                <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                  {[
                    [featured.home.short, featured.odds[0].home],
                    ["Nul", featured.odds[0].draw],
                    [featured.away.short, featured.odds[0].away],
                  ].map(([lab, n]) => (
                    <div key={String(lab)} className="rounded-xl bg-white/5 px-2 py-3">
                      <div className="text-[10px] uppercase tracking-wider text-mist">{lab}</div>
                      <div className="mt-1 font-score text-2xl text-lime">{oddsFr(Number(n))}</div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
            {featured.prediction && (
              <div className="rounded-2xl border border-white/10 bg-ink-950/70 p-4 backdrop-blur">
                <p className="text-[10px] uppercase tracking-[0.2em] text-mist">xG du modèle</p>
                <p className="mt-2 font-display text-2xl">
                  {featured.prediction.xgHome.toFixed(2)}
                  <span className="mx-2 text-mist">–</span>
                  {featured.prediction.xgAway.toFixed(2)}
                </p>
                <p className="mt-2 text-xs text-mist">{featured.prediction.advice}</p>
              </div>
            )}
          </div>
        </div>
      </section>

      {live.length > 0 && (
        <section>
          <SectionTitle href="/live" title="En ce moment" kicker={`${live.length} live`} />
          <div className="grid gap-3 md:grid-cols-2">
            {live.map((m) => (
              <MatchCard key={m.id} match={m} />
            ))}
          </div>
        </section>
      )}

      <section className="grid gap-8 lg:grid-cols-[1.4fr_.8fr]">
        <div>
          <SectionTitle href="/matchs" title="Aujourd'hui" kicker={ymd()} />
          <div className="rounded-2xl border border-white/8 bg-ink-800/40 px-3">
            {today.map((m) => (
              <MatchRow key={m.id} match={m} />
            ))}
          </div>
        </div>
        <div className="space-y-6">
          <div>
            <SectionTitle href="/cotes" title="Value" kicker="edge ≥ 4%" />
            <div className="space-y-2">
              {values.length === 0 && <p className="text-sm text-mist">Pas de value nette ce soir.</p>}
              {values.map((v) => (
                <Link
                  key={`${v.match.id}-${v.side}`}
                  href={`/matchs/${v.match.id}`}
                  className="block rounded-2xl border border-white/8 bg-ink-800/50 p-4 hover:border-lime/40"
                >
                  <div className="flex items-center justify-between text-xs text-mist">
                    <span>{v.match.league.name}</span>
                    <span className="text-lime">+{(v.edge * 100).toFixed(1)}%</span>
                  </div>
                  <p className="mt-1 font-medium">
                    {v.side === "home" ? v.match.home.name : v.side === "away" ? v.match.away.name : "Nul"}
                  </p>
                  <p className="mt-1 text-xs text-mist">
                    {v.bookmaker} · {oddsFr(v.odds)} · modèle {pct(v.modelProb)}
                  </p>
                </Link>
              ))}
            </div>
          </div>
          <div>
            <SectionTitle href="/matchs" title="Clôtures" kicker="week-end" />
            <div className="rounded-2xl border border-white/8 bg-ink-800/40 px-3">
              {recent.map((m) => (
                <MatchRow key={m.id} match={m} />
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function SectionTitle({ title, kicker, href }: { title: string; kicker: string; href: string }) {
  return (
    <div className="mb-4 flex items-end justify-between">
      <div>
        <p className="text-[10px] uppercase tracking-[0.22em] text-lime">{kicker}</p>
        <h2 className="font-display text-2xl">{title}</h2>
      </div>
      <Link href={href} className="text-xs text-mist hover:text-lime">
        Tout voir
      </Link>
    </div>
  );
}
