import { Crest } from "@/components/crest";
import { LiveMinute, StatusChip } from "@/components/live-clock";
import { OddsBoard } from "@/components/odds-board";
import { Pitch } from "@/components/pitch";
import { getMatch } from "@/lib/engine";
import { fmtDateLong, fmtTime, pct } from "@/lib/format";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const m = getMatch(id);
  if (!m) return { title: "Match" };
  return { title: `${m.home.short}–${m.away.short}` };
}

export default async function MatchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const m = getMatch(id);
  if (!m) notFound();
  const pred = m.prediction;

  return (
    <div className="space-y-8">
      <section className="overflow-hidden rounded-[28px] border border-white/10 bg-ink-800/60">
        {m.highlightThumb && (
          <div className="relative h-40 md:h-56">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={m.highlightThumb} alt="" className="h-full w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-ink-900 to-transparent" />
          </div>
        )}
        <div className="p-6 md:p-8">
          <div className="flex flex-wrap items-center gap-3 text-xs uppercase tracking-[0.18em] text-mist">
            <StatusChip status={m.status} />
            <span>{m.league.name}</span>
            <span>{fmtDateLong(m.kickoff)}</span>
            <span>{fmtTime(m.kickoff)}</span>
            {m.venue && <span>{m.venue}</span>}
          </div>
          <div className="mt-6 grid grid-cols-[1fr_auto_1fr] items-center gap-4">
            <TeamBlock team={m.home} align="right" />
            <div className="text-center">
              <p className="font-score text-6xl tabular leading-none text-lime md:text-7xl">
                {m.score.home ?? "–"}
                <span className="mx-2 text-paper/30">:</span>
                {m.score.away ?? "–"}
              </p>
              <p className="mt-2 text-sm text-mist">
                <LiveMinute kickoff={m.kickoff} />
              </p>
            </div>
            <TeamBlock team={m.away} align="left" />
          </div>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-white/8 bg-ink-800/40 p-5">
          <h2 className="font-display text-xl">Timeline</h2>
          <ol className="mt-4 space-y-3">
            {m.events.length === 0 && <p className="text-sm text-mist">Pas encore d&apos;événement.</p>}
            {m.events.map((e, i) => (
              <li key={i} className="flex items-start gap-3 text-sm">
                <span className="w-10 font-score tabular text-lime">{e.minute}&apos;</span>
                <span className="text-mist">{label(e.type)}</span>
                <span>
                  {e.player}
                  {e.assist ? ` · pass ${e.assist}` : ""}
                  <span className="text-mist"> · {e.team === "home" ? m.home.short : m.away.short}</span>
                </span>
              </li>
            ))}
          </ol>
        </section>

        {pred && (
          <section className="rounded-2xl border border-white/8 bg-ink-800/40 p-5">
            <h2 className="font-display text-xl">Pronostic modèle</h2>
            <p className="mt-2 text-sm text-mist">{pred.advice}</p>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              <Stat k={m.home.short} v={pct(pred.home)} />
              <Stat k="Nul" v={pct(pred.draw)} />
              <Stat k={m.away.short} v={pct(pred.away)} />
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2 text-center">
              <Stat k="xG domicile" v={pred.xgHome.toFixed(2)} />
              <Stat k="xG extérieur" v={pred.xgAway.toFixed(2)} />
            </div>
          </section>
        )}
      </div>

      {m.stats && (
        <section className="rounded-2xl border border-white/8 bg-ink-800/40 p-5">
          <h2 className="font-display text-xl">Statistiques</h2>
          <div className="mt-4 space-y-3">
            {m.stats.map((s) => {
              const tot = (s.home + s.away) || 1;
              return (
                <div key={s.label}>
                  <div className="mb-1 flex justify-between text-xs text-mist">
                    <span className="tabular text-paper">{s.home}</span>
                    <span>{s.label}</span>
                    <span className="tabular text-paper">{s.away}</span>
                  </div>
                  <div className="flex h-1.5 overflow-hidden rounded-full bg-white/10">
                    <div className="bg-lime" style={{ width: `${(s.home / tot) * 100}%` }} />
                    <div className="bg-live" style={{ width: `${(s.away / tot) * 100}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {m.lineups && (
        <section>
          <h2 className="mb-4 font-display text-xl">Compositions</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <p className="mb-2 text-sm text-mist">{m.home.name}</p>
              <Pitch formation={m.lineups.home.formation} players={m.lineups.home.start} />
            </div>
            <div>
              <p className="mb-2 text-sm text-mist">{m.away.name}</p>
              <Pitch formation={m.lineups.away.formation} players={m.lineups.away.start} flip accent="live" />
            </div>
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-4 font-display text-xl">Cotes 1N2</h2>
        <OddsBoard match={m} />
      </section>
    </div>
  );
}

function TeamBlock({ team, align }: { team: { name: string; short: string; crest: string }; align: "left" | "right" }) {
  return (
    <div className={`flex items-center gap-3 ${align === "right" ? "justify-end text-right" : ""}`}>
      {align === "left" && <Crest team={team} size={56} />}
      <div>
        <p className="font-display text-xl leading-tight md:text-2xl">{team.name}</p>
        <p className="text-xs uppercase tracking-widest text-mist">{team.short}</p>
      </div>
      {align === "right" && <Crest team={team} size={56} />}
    </div>
  );
}

function Stat({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-xl bg-white/5 px-3 py-3">
      <div className="text-[10px] uppercase tracking-wider text-mist">{k}</div>
      <div className="mt-1 font-score text-2xl text-lime">{v}</div>
    </div>
  );
}

function label(t: string) {
  switch (t) {
    case "goal":
      return "But";
    case "penalty":
      return "Pénalty";
    case "own_goal":
      return "CSC";
    case "yellow":
      return "Jaune";
    case "red":
      return "Rouge";
    case "sub":
      return "Rempl.";
    default:
      return t;
  }
}
