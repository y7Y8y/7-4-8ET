import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { fmtKick, odds3 } from "@/lib/format";
import { findMatch } from "@/lib/xbet/day-store";

export const dynamic = "force-dynamic";

export default async function MatchJourneePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ day?: string }>;
}) {
  const { id } = await params;
  const { day } = await searchParams;
  const numeric = Number(id);

  // Note : avec le loading.tsx global, Next streame le shell en 200 avant que
  // notFound() ne sorte — on rend donc un état « introuvable » propre soi-même.
  const found =
    Number.isInteger(numeric) && numeric > 0 ? await findMatch(numeric, day) : null;
  if (!found) {
    return (
      <div className="space-y-5">
        <Link href={`/journee${day ? `?day=${day}` : ""}`} className="inline-flex items-center gap-1.5 text-xs text-mist">
          <ArrowLeft size={14} /> Retour à la journée
        </Link>
        <div className="rounded-3xl border border-white/10 bg-ink-800/60 p-8 text-center">
          <h1 className="font-display text-2xl font-semibold">Match introuvable</h1>
          <p className="mt-2 text-sm text-mist">
            Ce match n&apos;est pas dans la journée {day ? day : "chargée"}. Elle a peut-être été actualisée — retourne en arrière et recharge.
          </p>
        </div>
      </div>
    );
  }
  const { match: m, line } = found;

  return (
    <div className="space-y-5">
      <Link href={`/journee${day ? `?day=${day}` : ""}`} className="inline-flex items-center gap-1.5 text-xs text-mist">
        <ArrowLeft size={14} /> Retour à la journée
      </Link>

      <div className="rounded-3xl border border-white/10 bg-ink-800/60 p-5">
        <p className="text-[10px] uppercase tracking-[0.2em] text-mist">
          {m.sport} · {m.league}
        </p>
        <h1 className="mt-2 font-display text-2xl font-semibold leading-tight">
          {m.home} <span className="text-mist">vs</span> {m.away}
        </h1>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px]">
          <span className={`rounded-full px-2 py-0.5 font-semibold ${m.live ? "bg-live/15 text-live" : m.started ? "bg-white/10 text-mist" : "bg-lime/15 text-lime"}`}>
            {m.live ? "EN DIRECT" : m.started ? "Commencé" : "À venir"}
          </span>
          <span className="text-mist">{fmtKick(m.kickoff)} (Abidjan)</span>
          <span className="text-mist/70">· 1xBet match #{m.id}</span>
        </div>
      </div>

      <p className="text-xs text-mist">
        {m.enriched
          ? `${m.marketCount} marchés ouverts — recopie la cote que tu veux sur 1xBet.`
          : "Marchés détaillés indisponibles pour ce match — cotes de base (1 · N · 2)."}
      </p>

      {m.markets.map((market, i) => (
        <section key={`${market.name}-${i}`} className="overflow-hidden rounded-3xl border border-white/10 bg-ink-800/50">
          <h2 className="border-b border-white/8 px-4 py-3 text-sm font-semibold text-paper">
            {market.name}
            <span className="ml-2 text-[10px] font-normal uppercase tracking-[0.18em] text-mist">
              {market.selections.length} choix
            </span>
          </h2>
          <ul>
            {market.selections.map((s, j) => (
              <li
                key={`${s.code}-${s.param ?? "x"}-${j}`}
                className="flex items-center justify-between gap-3 border-b border-white/5 px-4 py-2.5 last:border-0"
              >
                <span className="min-w-0 truncate text-sm text-mist">{s.name}</span>
                <span className="shrink-0 font-score text-xl tabular text-lime">{odds3(s.odd)}</span>
              </li>
            ))}
          </ul>
        </section>
      ))}

      {line.partial && (
        <p className="rounded-xl border border-white/8 bg-ink-800/40 px-3 py-2 text-[11px] text-mist">
          Ligne partielle : certains matchs du {line.day} n&apos;ont pas pu être enrichis à temps. Appuie sur Actualiser depuis la journée pour retenter.
        </p>
      )}
    </div>
  );
}
