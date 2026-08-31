import { Crest } from "./crest";
import { fmtTime } from "@/lib/format";
import type { Match } from "@/lib/types";

export function Ticker({ matches }: { matches: Match[] }) {
  const loop = [...matches, ...matches];
  return (
    <div className="mask-fade overflow-hidden rounded-full border border-white/8 bg-ink-800/70">
      <div className="marquee-track flex w-max gap-8 px-6 py-2.5">
        {loop.map((m, i) => (
          <span key={`${m.id}-${i}`} className="flex items-center gap-2 text-xs">
            <span className="text-[10px] uppercase tracking-wider text-mist">{m.league.name}</span>
            <Crest team={m.home} size={14} />
            <span>{m.home.short}</span>
            <span className={`font-score tabular ${m.status === "live" ? "text-lime" : ""}`}>
              {m.status === "scheduled"
                ? fmtTime(m.kickoff)
                : `${m.score.home ?? 0}–${m.score.away ?? 0}`}
            </span>
            <Crest team={m.away} size={14} />
            <span>{m.away.short}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
