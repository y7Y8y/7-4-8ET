import Link from "next/link";
import { Crest } from "@/components/crest";
import { PageHead } from "@/components/shell";
import { predictions } from "@/lib/engine";
import { fmtTime, pct } from "@/lib/format";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Pronostics" };

export default function PredictionsPage() {
  const rows = predictions();
  return (
    <div>
      <PageHead
        kicker="Modèle"
        title="Pas un oracle. Un Poisson."
        sub="Chaque équipe a une force d'attaque / défense. On tire des xG, une grille 0-8 buts, des probabilités 1N2. API-Football Predictions et Highlightly se greffent dès qu'ils répondent."
      />
      <div className="grid gap-3">
        {rows.map(({ match, prediction }) => (
          <Link
            key={match.id}
            href={`/matchs/${match.id}`}
            className="grid gap-4 rounded-2xl border border-white/8 bg-ink-800/50 p-5 md:grid-cols-[1.2fr_1fr]"
          >
            <div>
              <p className="text-[10px] uppercase tracking-[0.2em] text-mist">
                {match.league.name} · {fmtTime(match.kickoff)}
              </p>
              <div className="mt-3 flex items-center gap-3">
                <Crest team={match.home} size={28} />
                <span className="font-display text-xl">{match.home.name}</span>
              </div>
              <div className="mt-2 flex items-center gap-3">
                <Crest team={match.away} size={28} />
                <span className="font-display text-xl">{match.away.name}</span>
              </div>
              <p className="mt-3 text-sm text-mist">{prediction.advice}</p>
            </div>
            <div>
              <Bars
                home={prediction.home}
                draw={prediction.draw}
                away={prediction.away}
                h={match.home.short}
                a={match.away.short}
              />
              <div className="mt-4 flex gap-4 text-xs text-mist">
                <span>xG {prediction.xgHome.toFixed(2)}</span>
                <span>xG {prediction.xgAway.toFixed(2)}</span>
                <span className="text-lime">conf. {prediction.confidence}%</span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

function Bars({
  home,
  draw,
  away,
  h,
  a,
}: {
  home: number;
  draw: number;
  away: number;
  h: string;
  a: string;
}) {
  return (
    <div className="space-y-2">
      {[
        [h, home],
        ["Nul", draw],
        [a, away],
      ].map(([lab, p]) => (
        <div key={String(lab)}>
          <div className="mb-1 flex justify-between text-[11px] uppercase tracking-wider text-mist">
            <span>{lab}</span>
            <span className="tabular text-paper">{pct(Number(p))}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-white/10">
            <div className="h-full bg-lime" style={{ width: `${Number(p) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}
