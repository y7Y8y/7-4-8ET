import { MatchRow } from "@/components/match-card";
import { PageHead } from "@/components/shell";
import { allMatches, matchesOn } from "@/lib/engine";
import { addDays, fmtDate, ymd } from "@/lib/format";
import Link from "next/link";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Matchs" };

export default async function MatchesPage({
  searchParams,
}: {
  searchParams: Promise<{ jour?: string }>;
}) {
  const { jour } = await searchParams;
  const day = jour && /^\d{4}-\d{2}-\d{2}$/.test(jour) ? jour : ymd();
  const rows = matchesOn(day);
  const days = [-2, -1, 0, 1, 2].map((n) => addDays(ymd(), n));
  const byLeague = rows.reduce((acc, m) => {
    const k = m.league.name;
    acc.set(k, [...(acc.get(k) ?? []), m]);
    return acc;
  }, new Map<string, typeof rows>());

  return (
    <div>
      <PageHead
        kicker="Calendrier"
        title="Tous les matchs."
        sub={`${allMatches().length} rencontres en mémoire locale + APIs. Filtre par jour, ouvre le centre match.`}
      />
      <div className="mb-8 flex flex-wrap gap-2">
        {days.map((d) => (
          <Link
            key={d}
            href={`/matchs?jour=${d}`}
            className={`rounded-full px-4 py-2 text-sm ${
              d === day ? "bg-lime text-ink-950" : "bg-white/5 text-mist hover:text-paper"
            }`}
          >
            {fmtDate(`${d}T12:00:00+02:00`)}
          </Link>
        ))}
      </div>
      {rows.length === 0 ? (
        <p className="text-mist">Rien de programmé ce jour-là dans le cockpit.</p>
      ) : (
        <div className="space-y-8">
          {[...byLeague.entries()].map(([league, list]) => (
            <section key={league} className="rounded-2xl border border-white/8 bg-ink-800/40 px-3">
              <h2 className="px-1 pb-1 pt-4 text-[11px] uppercase tracking-[0.2em] text-mist">{league}</h2>
              {list.map((m) => (
                <MatchRow key={m.id} match={m} />
              ))}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
