import Link from "next/link";
import { PageHead } from "@/components/shell";
import { highlights } from "@/lib/engine";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Highlights" };

export default function HighlightsPage() {
  const clips = highlights();
  return (
    <div>
      <PageHead
        kicker="Bande-annonce"
        title="Les images."
        sub="Highlightly fournit les clips géo-disponibles. Ici, une grille éditoriale en attendant le flux — chaque carte ouvre le centre match."
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {clips.map((h) => (
          <Link
            key={h.id}
            href={h.matchId ? `/matchs/${h.matchId}` : "/highlights"}
            className="group overflow-hidden rounded-2xl border border-white/8 bg-ink-800/50"
          >
            <div className="relative aspect-video">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={h.thumb} alt="" className="h-full w-full object-cover transition group-hover:scale-[1.03]" />
              <span className="absolute bottom-3 right-3 rounded bg-ink-950/80 px-2 py-0.5 text-[11px] tabular">
                {h.duration}
              </span>
              <span className="absolute left-3 top-3 rounded-full bg-live px-2 py-0.5 text-[10px] uppercase tracking-wider">
                {h.league}
              </span>
            </div>
            <div className="p-4">
              <p className="font-display text-lg leading-tight">{h.title}</p>
              <p className="mt-1 text-xs text-mist">
                {h.home} × {h.away}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
