import { Crest } from "@/components/crest";
import { MatchRow } from "@/components/match-card";
import { allMatches, LEAGUES, standings } from "@/lib/engine";
import { TRACKED } from "@/lib/leagues";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  return { title: LEAGUES[id]?.name ?? "Championnat" };
}

export default async function LeaguePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!TRACKED.includes(id as (typeof TRACKED)[number]) && !LEAGUES[id]) notFound();
  const league = LEAGUES[id];
  if (!league) notFound();
  const table = standings(id);
  const fixtures = allMatches().filter((m) => m.league.id === id);

  return (
    <div>
      <header className="mb-8 flex items-center gap-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={league.crest} alt="" className="h-14 w-14 object-contain" />
        <div>
          <p className="text-[11px] uppercase tracking-[0.24em] text-lime">{league.country}</p>
          <h1 className="font-display text-4xl">{league.name}</h1>
        </div>
      </header>

      {table.length > 0 && (
        <div className="mb-10 overflow-x-auto rounded-2xl border border-white/8">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-white/5 text-[11px] uppercase tracking-[0.16em] text-mist">
              <tr>
                {["#", "Club", "J", "G", "N", "P", "BP", "BC", "Diff", "Pts", "Forme"].map((h) => (
                  <th key={h} className="px-3 py-3 text-left font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {table.map((r) => (
                <tr key={r.team.id} className="border-t border-white/5">
                  <td className="px-3 py-3 tabular text-mist">{r.rank}</td>
                  <td className="px-3 py-3">
                    <span className="flex items-center gap-2">
                      <Crest team={r.team} size={20} />
                      {r.team.name}
                    </span>
                  </td>
                  <td className="px-3 py-3 tabular">{r.played}</td>
                  <td className="px-3 py-3 tabular">{r.won}</td>
                  <td className="px-3 py-3 tabular">{r.draw}</td>
                  <td className="px-3 py-3 tabular">{r.lost}</td>
                  <td className="px-3 py-3 tabular">{r.gf}</td>
                  <td className="px-3 py-3 tabular">{r.ga}</td>
                  <td className="px-3 py-3 tabular">{r.gd > 0 ? `+${r.gd}` : r.gd}</td>
                  <td className="px-3 py-3 font-score text-lg text-lime">{r.pts}</td>
                  <td className="px-3 py-3">
                    <span className="flex gap-1">
                      {r.form.map((f, i) => (
                        <i
                          key={i}
                          className={`grid h-5 w-5 place-items-center rounded text-[10px] font-bold ${
                            f === "W" ? "bg-lime text-ink-950" : f === "D" ? "bg-white/15" : "bg-live text-white"
                          }`}
                        >
                          {f}
                        </i>
                      ))}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {fixtures.length > 0 && (
        <section className="rounded-2xl border border-white/8 bg-ink-800/40 px-3">
          <h2 className="px-1 pb-1 pt-4 font-display text-xl">Matchs</h2>
          {fixtures.map((m) => (
            <MatchRow key={m.id} match={m} />
          ))}
        </section>
      )}
    </div>
  );
}
