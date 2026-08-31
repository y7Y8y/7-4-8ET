import { MatchCard } from "@/components/match-card";
import { PageHead } from "@/components/shell";
import { allMatches, liveMatches } from "@/lib/engine";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Live" };

export default function LivePage() {
  const live = liveMatches();
  const upcoming = allMatches().filter((m) => m.status === "scheduled").slice(0, 8);
  const grouped = live.reduce((acc, m) => {
    const arr = acc.get(m.league.name) ?? [];
    arr.push(m);
    acc.set(m.league.name, arr);
    return acc;
  }, new Map<string, typeof live>());

  return (
    <div>
      <PageHead
        kicker="Direct"
        title="Le terrain, maintenant."
        sub="Les minutes avancent toutes seules. Les buts se déverrouillent à l'horloge réelle — pas un GIF figé."
      />
      {live.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-white/15 p-10 text-center">
          <p className="font-display text-2xl">Aucun live à cette seconde.</p>
          <p className="mt-2 text-sm text-mist">Les coups d&apos;envoi du soir arrivent. En attendant :</p>
        </div>
      ) : (
        <div className="space-y-8">
          {[...grouped.entries()].map(([league, rows]) => (
            <section key={league}>
              <h2 className="mb-3 text-[11px] uppercase tracking-[0.22em] text-mist">{league}</h2>
              <div className="grid gap-3 md:grid-cols-2">
                {rows.map((m) => (
                  <MatchCard key={m.id} match={m} featured />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
      {upcoming.length > 0 && (
        <section className="mt-12">
          <h2 className="mb-3 font-display text-2xl">Prochains coups d&apos;envoi</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {upcoming.map((m) => (
              <MatchCard key={m.id} match={m} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
