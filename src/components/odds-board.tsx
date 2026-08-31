import { oddsFr, pct } from "@/lib/format";
import { bestOdds } from "@/lib/model";
import type { Match } from "@/lib/types";

export function OddsBoard({ match }: { match: Match }) {
  const best = bestOdds(match);
  if (!match.odds.length || !best) {
    return <p className="text-sm text-mist">Cotes indisponibles pour ce match.</p>;
  }
  const pred = match.prediction;
  return (
    <div className="overflow-x-auto rounded-2xl border border-white/8">
      <table className="w-full min-w-[520px] text-left text-sm">
        <thead className="bg-white/5 text-[11px] uppercase tracking-[0.16em] text-mist">
          <tr>
            <th className="px-4 py-3 font-medium">Bookmaker</th>
            <th className="px-4 py-3 font-medium">{match.home.short}</th>
            <th className="px-4 py-3 font-medium">Nul</th>
            <th className="px-4 py-3 font-medium">{match.away.short}</th>
          </tr>
        </thead>
        <tbody>
          {match.odds.map((q) => (
            <tr key={q.bookmaker} className="border-t border-white/5">
              <td className="px-4 py-3 text-paper">{q.bookmaker}</td>
              <Cell n={q.home} best={best.home} />
              <Cell n={q.draw} best={best.draw} />
              <Cell n={q.away} best={best.away} />
            </tr>
          ))}
        </tbody>
      </table>
      {pred && (
        <div className="grid grid-cols-3 border-t border-white/8 bg-ink-900/60 text-center text-xs">
          <Prob label={match.home.short} p={pred.home} />
          <Prob label="Nul" p={pred.draw} />
          <Prob label={match.away.short} p={pred.away} />
        </div>
      )}
    </div>
  );
}

function Cell({ n, best }: { n: number; best: number }) {
  const is = n === best;
  return (
    <td className="px-4 py-3">
      <span
        className={`inline-block rounded-lg px-2 py-1 font-score tabular ${
          is ? "bg-lime text-ink-950" : "bg-white/5 text-paper"
        }`}
      >
        {oddsFr(n)}
      </span>
    </td>
  );
}

function Prob({ label, p }: { label: string; p: number }) {
  return (
    <div className="px-3 py-3">
      <div className="text-[10px] uppercase tracking-wider text-mist">{label}</div>
      <div className="mt-1 font-score text-lg tabular text-lime">{pct(p)}</div>
      <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/10">
        <div className="h-full bg-lime" style={{ width: `${p * 100}%` }} />
      </div>
    </div>
  );
}
