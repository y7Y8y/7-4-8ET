import Link from "next/link";
import { PageHead } from "@/components/shell";
import { LEAGUES, standings } from "@/lib/engine";
import { TRACKED } from "@/lib/leagues";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Championnats" };

export default function LeaguesPage() {
  return (
    <div>
      <PageHead
        kicker="Europe"
        title="Les tables."
        sub="Big 5 + Portugal + C1. football-data.org et API-Football alimentent les classements dès que le réseau les laisse passer."
      />
      <div className="grid gap-3 sm:grid-cols-2">
        {TRACKED.map((id) => {
          const l = LEAGUES[id];
          const table = standings(id);
          return (
            <Link
              key={id}
              href={`/championnats/${id}`}
              className="flex items-center gap-4 rounded-2xl border border-white/8 bg-ink-800/50 p-5 hover:border-lime/40"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={l.crest} alt="" className="h-12 w-12 object-contain" />
              <div className="flex-1">
                <p className="font-display text-xl">{l.name}</p>
                <p className="text-xs text-mist">
                  {l.country}
                  {table[0] ? ` · leader ${table[0].team.name}` : ""}
                </p>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
