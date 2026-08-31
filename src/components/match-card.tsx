import Link from "next/link";
import { Crest } from "./crest";
import { LiveMinute, StatusChip } from "./live-clock";
import { fmtTime } from "@/lib/format";
import type { Match } from "@/lib/types";

function goals(match: Match, side: "home" | "away") {
  return match.events
    .filter((e) => (e.type === "goal" || e.type === "penalty" || e.type === "own_goal") && e.team === side)
    .map((e) => `${e.player} ${e.minute}'`)
    .join(" · ");
}

export function MatchCard({ match, featured = false }: { match: Match; featured?: boolean }) {
  const live = match.status === "live" || match.status === "ht";
  return (
    <Link
      href={`/matchs/${match.id}`}
      className={`group relative block overflow-hidden rounded-2xl border border-white/8 bg-ink-800/80 p-4 transition hover:border-lime/40 hover:bg-ink-700 ${
        featured ? "p-5 md:p-6" : ""
      }`}
    >
      <div className="flex items-center justify-between gap-3 text-[11px] uppercase tracking-[0.16em] text-mist">
        <span className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={match.league.crest} alt="" className="h-4 w-4 object-contain" />
          {match.league.name}
        </span>
        <StatusChip status={match.status} />
      </div>

      <div className={`mt-4 grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-3 ${featured ? "md:mt-6" : ""}`}>
        <TeamLine team={match.home} />
        <Score n={match.score.home} live={live} big={featured} />
        <TeamLine team={match.away} />
        <Score n={match.score.away} live={live} big={featured} />
      </div>

      <div className="mt-4 flex items-center justify-between text-xs text-mist">
        <span className="tabular">
          {match.status === "scheduled" ? fmtTime(match.kickoff) : <LiveMinute kickoff={match.kickoff} />}
          {match.venue ? ` · ${match.venue}` : ""}
        </span>
        {match.prediction && match.status !== "finished" && (
          <span className="text-[11px] text-lime">
            Modèle {match.prediction.pick === "home" ? match.home.short : match.prediction.pick === "away" ? match.away.short : "NUL"}{" "}
            {match.prediction.confidence}%
          </span>
        )}
      </div>
      {(goals(match, "home") || goals(match, "away")) && (
        <p className="mt-2 line-clamp-1 text-[11px] text-mist/80">
          {goals(match, "home")}
          {goals(match, "home") && goals(match, "away") ? " — " : ""}
          {goals(match, "away")}
        </p>
      )}
    </Link>
  );
}

function TeamLine({ team }: { team: Match["home"] }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <Crest team={team} size={28} />
      <span className="truncate font-medium tracking-tight">{team.name}</span>
    </div>
  );
}

function Score({ n, live, big }: { n: number | null; live: boolean; big?: boolean }) {
  return (
    <span
      className={`font-score tabular leading-none ${big ? "text-4xl md:text-5xl" : "text-2xl"} ${
        live ? "text-lime" : "text-paper"
      }`}
    >
      {n ?? "–"}
    </span>
  );
}

export function MatchRow({ match }: { match: Match }) {
  return (
    <Link
      href={`/matchs/${match.id}`}
      className="grid grid-cols-[88px_1fr_auto] items-center gap-3 border-b border-white/5 px-1 py-3 text-sm transition hover:bg-white/[0.03] md:grid-cols-[110px_1fr_auto]"
    >
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-mist">
        {match.status === "live" || match.status === "ht" ? (
          <StatusChip status={match.status} />
        ) : match.status === "finished" ? (
          <span>FT</span>
        ) : (
          <span className="tabular">{fmtTime(match.kickoff)}</span>
        )}
      </div>
      <div className="min-w-0">
        <div className="flex items-center justify-between gap-3">
          <span className="flex min-w-0 items-center gap-2">
            <Crest team={match.home} size={18} />
            <span className="truncate">{match.home.name}</span>
          </span>
          <span className={`font-score tabular ${match.status === "live" ? "text-lime" : ""}`}>
            {match.score.home ?? "–"}
          </span>
        </div>
        <div className="mt-1 flex items-center justify-between gap-3">
          <span className="flex min-w-0 items-center gap-2">
            <Crest team={match.away} size={18} />
            <span className="truncate">{match.away.name}</span>
          </span>
          <span className={`font-score tabular ${match.status === "live" ? "text-lime" : ""}`}>
            {match.score.away ?? "–"}
          </span>
        </div>
      </div>
      <div className="hidden w-16 text-right text-[11px] text-mist sm:block">
        {match.status === "live" || match.status === "ht" ? <LiveMinute kickoff={match.kickoff} /> : match.league.country}
      </div>
    </Link>
  );
}
