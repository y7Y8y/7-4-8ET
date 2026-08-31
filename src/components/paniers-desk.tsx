"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Copy, Trash2, ChevronDown, Radar } from "lucide-react";
import { fmtKick, odds3 } from "@/lib/format";
import { couponText, purgeStarted } from "@/lib/xbet/pack";
import { loadLocalState, saveLocalState } from "@/lib/xbet/local";
import type { Panier, XbetState } from "@/lib/xbet/types";

const empty: XbetState = {
  day: "",
  scannedAt: null,
  host: null,
  pool: 0,
  paniers: [],
  error: null,
};

export function PaniersDesk() {
  const [state, setState] = useState<XbetState>(empty);
  const [open, setOpen] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    const local = loadLocalState();
    if (local) setState(local);
    void refresh();
  }, []);

  useEffect(() => {
    if (!open && state.paniers[0]) setOpen(state.paniers[0].id);
  }, [state.paniers, open]);

  async function refresh() {
    try {
      const res = await fetch("/api/xbet/paniers", { cache: "no-store" });
      const json = (await res.json()) as { state?: XbetState };
      if (json.state) {
        const merged = preferNewer(loadLocalState(), json.state);
        const cleaned = { ...merged, paniers: purgeStarted(merged.paniers) };
        setState(cleaned);
        saveLocalState(cleaned);
      }
    } catch {
      const local = loadLocalState();
      if (local) setState({ ...local, paniers: purgeStarted(local.paniers) });
    }
  }

  async function drop(id: string) {
    const next = { ...state, paniers: state.paniers.filter((p) => p.id !== id) };
    setState(next);
    saveLocalState(next);
    try {
      await fetch(`/api/xbet/paniers?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    } catch {
      /* local only */
    }
  }

  async function copy(b: Panier) {
    try {
      await navigator.clipboard.writeText(couponText(b));
      setCopied(b.id);
      setTimeout(() => setCopied(null), 1600);
    } catch {
      setNote("Copie impossible — sélectionne le texte.");
    }
  }

  const started = useMemo(
    () => state.paniers.filter((p) => p.legs.some((l) => +new Date(l.kickoff) <= Date.now())),
    [state.paniers],
  );

  useEffect(() => {
    if (!started.length) return;
    const next = { ...state, paniers: purgeStarted(state.paniers) };
    setState(next);
    saveLocalState(next);
    setNote(`${started.length} panier${started.length > 1 ? "s" : ""} retiré${started.length > 1 ? "s" : ""} — un match a commencé.`);
  }, [started.length]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!state.paniers.length) {
    return (
      <div className="flex min-h-[70dvh] flex-col items-center justify-center text-center">
        <p className="text-[11px] uppercase tracking-[0.28em] text-lime">Aujourd&apos;hui</p>
        <h1 className="mt-3 font-display text-4xl font-semibold leading-none">Aucun panier</h1>
        <p className="mt-4 max-w-xs text-sm text-mist">
          Scanne 1xBet. On empile jusqu&apos;à 50 cotes entre 1,007 et 1,01 — 5 paniers max.
        </p>
        <Link
          href="/scan"
          className="mt-8 inline-flex items-center gap-2 rounded-full bg-lime px-6 py-3 text-sm font-semibold text-ink-950"
        >
          <Radar size={16} /> Scanner 1xBet
        </Link>
        {state.error && <p className="mt-4 text-xs text-live">{state.error}</p>}
        {note && <p className="mt-3 text-xs text-mist">{note}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-[11px] uppercase tracking-[0.28em] text-lime">
          {state.paniers.length} / 5 paniers
        </p>
        <h1 className="mt-1 font-display text-3xl font-semibold">Tes combinés 1,01</h1>
        <p className="mt-2 text-xs text-mist">
          {state.host ? new URL(state.host).hostname : "1xBet"}
          {state.scannedAt ? ` · ${fmtKick(state.scannedAt)}` : ""} · {state.pool} matchs
        </p>
        <p className="mt-3 rounded-2xl border border-white/8 bg-ink-800/40 px-3 py-2 text-xs text-mist">
          Tu es déjà dans l&apos;app. En bas : <span className="text-paper">Paniers</span> ·{" "}
          <Link href="/scan" className="text-lime">
            Scanner
          </Link>{" "}
          (bouton vert) · Infos. Appuie un panier pour voir match + cote, puis Copier, et recolle sur 1xBet.
        </p>
      </div>
      {note && <p className="rounded-xl border border-live/30 bg-live/10 px-3 py-2 text-xs text-live">{note}</p>}
      {state.paniers.map((b, i) => {
        const first = b.legs[0]?.kickoff;
        const last = b.legs[b.legs.length - 1]?.kickoff;
        const expanded = open === b.id;
        return (
          <article key={b.id} className="overflow-hidden rounded-3xl border border-white/10 bg-ink-800/60">
            <button
              type="button"
              onClick={() => setOpen(expanded ? null : b.id)}
              className="flex w-full items-start justify-between gap-3 px-4 py-4 text-left"
            >
              <div>
                <p className="text-[10px] uppercase tracking-[0.2em] text-mist">Panier {i + 1}</p>
                <p className="mt-1 font-score text-5xl leading-none text-lime">{odds3(b.product)}</p>
                <p className="mt-2 text-sm text-paper">
                  {b.legs.length} sélections
                  {first ? ` · dès ${fmtKick(first)}` : ""}
                </p>
                {last && last !== first && <p className="text-xs text-mist">jusqu&apos;à {fmtKick(last)}</p>}
              </div>
              <ChevronDown size={18} className={`mt-1 text-mist transition ${expanded ? "rotate-180" : ""}`} />
            </button>
            <div className="flex gap-2 px-4 pb-4">
              <button
                type="button"
                onClick={() => void copy(b)}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-lime px-3 py-2.5 text-sm font-semibold text-ink-950"
              >
                <Copy size={14} /> {copied === b.id ? "Copié" : "Copier"}
              </button>
              <button
                type="button"
                onClick={() => void drop(b.id)}
                className="inline-flex items-center justify-center gap-2 rounded-full border border-white/15 px-4 py-2.5 text-sm text-mist"
              >
                <Trash2 size={14} />
              </button>
            </div>
            {expanded && (
              <ol className="border-t border-white/8 px-2 pb-3 pt-1">
                {b.legs.map((l, n) => (
                  <li key={l.id} className="flex items-start gap-2 px-2 py-2.5">
                    <span className="w-6 shrink-0 pt-0.5 font-score text-lg text-mist">{n + 1}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {l.home} <span className="text-mist">vs</span> {l.away}
                      </p>
                      <p className="truncate text-xs text-mist">
                        {l.pick} · {l.market} · {l.league}
                      </p>
                      <p className="text-[11px] text-mist/80">{fmtKick(l.kickoff)}</p>
                    </div>
                    <span className="font-score text-2xl leading-none text-lime">{odds3(l.odd)}</span>
                  </li>
                ))}
              </ol>
            )}
          </article>
        );
      })}
    </div>
  );
}

function preferNewer(local: XbetState | null, server: XbetState): XbetState {
  if (!local?.scannedAt) return server;
  if (!server.scannedAt) return local.paniers.length ? local : server;
  return +new Date(server.scannedAt) >= +new Date(local.scannedAt) ? server : local;
}
