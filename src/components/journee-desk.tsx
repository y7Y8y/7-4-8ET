"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { CalendarDays, ChevronDown, RefreshCw } from "lucide-react";
import { odds3 } from "@/lib/format";
import type { DayLine } from "@/lib/xbet/day-types";

const ABIDJAN = "Africa/Abidjan";

function fmtHM(iso: string) {
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: ABIDJAN,
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

function dayStr(offsetDays: number) {
  const d = new Date(Date.now() + offsetDays * 86_400_000);
  return d.toISOString().slice(0, 10);
}

function sameDay(a: string, b: string) {
  return a === b;
}

export function JourneeDesk({
  initialDay,
  initialLine,
}: {
  initialDay: string;
  initialLine: DayLine | null;
}) {
  const [day, setDay] = useState(initialDay);
  const [line, setLine] = useState<DayLine | null>(initialLine);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  const load = useCallback(async (d: string, refresh: boolean) => {
    setBusy(true);
    setError(null);
    setMsg(refresh ? "Actualisation depuis 1xBet…" : "Chargement de la journée…");
    try {
      const res = await fetch(`/api/xbet/day?day=${d}${refresh ? "&refresh=1" : ""}`, {
        cache: "no-store",
        signal: AbortSignal.timeout(55_000),
      });
      const json = (await res.json().catch(() => null)) as {
        ok?: boolean;
        cached?: boolean;
        line?: DayLine | null;
        error?: string | null;
      } | null;
      if (json?.ok && json.line) {
        setLine(json.line);
        setMsg(
          json.cached
            ? `Données du cache · ${fmtHM(json.line.generatedAt)}`
            : `${json.line.stats.matches} matchs · ${json.line.stats.markets} marchés à jour`,
        );
      } else {
        setLine(null);
        setError(json?.error ?? "1xBet injoignable. Réessaie dans un instant.");
        setMsg(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Chargement interrompu");
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    if (!initialLine) void load(initialDay, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (line?.leagues?.length) {
      const first = line.leagues.find((l) => l.sport.toLowerCase() === "football") ?? line.leagues[0];
      setOpen(`${first.sport}||${first.league}`);
    }
  }, [line]);

  const chips: Array<{ label: string; day: string }> = [
    { label: "Hier", day: dayStr(-1) },
    { label: "Aujourd'hui", day: dayStr(0) },
    { label: "Demain", day: dayStr(1) },
  ];

  async function pickDay(d: string) {
    if (sameDay(d, day) && line) return;
    setDay(d);
    setLine(null);
    setOpen(null);
    await load(d, false);
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="text-[11px] uppercase tracking-[0.28em] text-lime">Ligne 1xBet complète</p>
        <h1 className="mt-1 font-display text-3xl font-semibold">La journée</h1>
        <p className="mt-2 text-sm text-mist">
          Toutes les ligues qui jouent, chaque match avec son heure et tous ses marchés. Recopie ce que tu veux sur 1xBet.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {chips.map((c) => (
          <button
            key={c.day}
            type="button"
            disabled={busy}
            onClick={() => void pickDay(c.day)}
            className={`rounded-full border px-3 py-2 text-xs font-semibold transition ${
              sameDay(c.day, day)
                ? "border-lime bg-lime text-ink-950"
                : "border-white/15 text-mist hover:border-white/30"
            } disabled:opacity-50`}
          >
            {c.label}
          </button>
        ))}
      </div>

      {line && (
        <div className="rounded-3xl border border-white/10 bg-ink-800/50 p-4">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-mist">
            <span className="text-paper">{line.stats.matches} matchs</span>
            <span>{line.stats.leagues} ligues</span>
            <span>{line.stats.markets} marchés</span>
            {line.host && <span>{new URL(line.host).hostname}</span>}
            <span>· {fmtHM(line.generatedAt)}</span>
          </div>
          <div className="mt-2 flex items-center gap-2 text-[11px] text-mist">
            <CalendarDays size={12} className="text-lime" />
            {line.stats.enriched}/{line.stats.matches} matchs avec tous leurs marchés
            {line.partial ? " (le reste en cotes de base — budget temps)" : ""}
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={() => void load(day, true)}
            className="mt-3 inline-flex items-center gap-2 rounded-full bg-lime px-4 py-2 text-xs font-semibold text-ink-950 disabled:opacity-60"
          >
            <RefreshCw size={13} className={busy ? "animate-spin" : ""} />
            {busy ? "Actualisation…" : "Actualiser"}
          </button>
        </div>
      )}

      {msg && <p className="text-center text-xs text-mist">{msg}</p>}
      {error && (
        <p className="rounded-xl border border-live/30 bg-live/10 px-3 py-2 text-xs text-live">{error}</p>
      )}

      {!busy && !line && !error && (
        <button
          type="button"
          onClick={() => void load(day, false)}
          className="w-full rounded-full bg-lime py-3 text-sm font-semibold text-ink-950"
        >
          Charger la journée
        </button>
      )}

      {line?.leagues?.map((lg) => {
        const key = `${lg.sport}||${lg.league}`;
        const expanded = open === key;
        return (
          <article key={key} className="overflow-hidden rounded-3xl border border-white/10 bg-ink-800/60">
            <button
              type="button"
              onClick={() => setOpen(expanded ? null : key)}
              className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-paper">{lg.league}</p>
                <p className="text-[11px] uppercase tracking-[0.18em] text-mist">
                  {lg.sport} · {lg.matches.length} matchs
                </p>
              </div>
              <ChevronDown size={16} className={`shrink-0 text-mist transition ${expanded ? "rotate-180" : ""}`} />
            </button>
            {expanded && (
              <ul className="border-t border-white/8">
                {lg.matches.map((m) => {
                  const base = m.markets[0]?.selections ?? [];
                  return (
                    <li key={m.id} className="border-b border-white/5 last:border-0">
                      <Link
                        href={`/journee/${m.id}?day=${line.day}`}
                        className="flex items-center gap-3 px-4 py-3 active:bg-white/5"
                      >
                        <span className="w-11 shrink-0 font-score text-lg tabular text-mist">
                          {fmtHM(m.kickoff)}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">
                            {m.home} <span className="text-mist">vs</span> {m.away}
                          </span>
                          <span className="block text-[11px] text-mist">
                            {m.live ? "EN DIRECT" : m.started ? "commencé" : `${m.marketCount} marchés${m.enriched ? "" : " (base)"}`}
                          </span>
                        </span>
                        <span className="flex shrink-0 items-center gap-1.5 font-score text-base tabular">
                          {base
                            .filter((s) => s.code === 1 || s.code === 2 || s.code === 3)
                            .map((s) => (
                              <span key={s.code} className="text-lime">
                                {odds3(s.odd)}
                              </span>
                            ))}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </article>
        );
      })}

      {line && !line.leagues.length && !error && (
        <p className="rounded-2xl border border-white/8 bg-ink-800/40 p-4 text-center text-sm text-mist">
          Aucun match ce jour-là sur 1xBet.
        </p>
      )}
    </div>
  );
}
