"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronDown, Copy, Radar, RefreshCw, Trash2 } from "lucide-react";
import { fmtKick, odds3, oddsFr, ymd } from "@/lib/format";
import { buildPaniers, couponText, purgeStartedDetailed } from "@/lib/xbet/pack";
import { daysKey, daysLabel, keyLabel } from "@/lib/xbet/days";
import { clientScrape } from "@/lib/xbet/client-scan";
import { loadLocalState, saveLocalState } from "@/lib/xbet/local";
import { useScanConfig } from "./scan-config";
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
  const { params, days } = useScanConfig();
  const [state, setState] = useState<XbetState>(empty);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("Prêt.");
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  // L'auto-ouverture du 1er panier ne doit jouer qu'une fois : sans ça, replier
  // le panier 1 le rouvrait aussitôt (impossible de le dérouler).
  const touchedRef = useRef(false);

  const scanDays = days.length ? days : [ymd()];

  /** Recharge l'état + purge AU MATCH PRÈS (la jambe commencée saute, le reste du panier reste). */
  const refresh = useCallback(async (announce: boolean) => {
    try {
      const res = await fetch("/api/xbet/paniers", { cache: "no-store" });
      const json = (await res.json()) as { state?: XbetState };
      if (json.state) {
        const merged = preferNewer(loadLocalState(), json.state);
        const report = purgeStartedDetailed(merged.paniers);
        const cleaned = { ...merged, paniers: report.paniers };
        setState(cleaned);
        saveLocalState(cleaned);
        if (announce) {
          setNote(purgeNote(report.legs, report.paniers_supprimes, report.paniers_reduits));
        }
      }
    } catch {
      const local = loadLocalState();
      if (local) {
        const report = purgeStartedDetailed(local.paniers);
        const cleaned = { ...local, paniers: report.paniers };
        setState(cleaned);
        saveLocalState(cleaned);
      }
    }
  }, []);

  useEffect(() => {
    const local = loadLocalState();
    if (local) setState(local);
    void refresh(false);
  }, [refresh]);

  useEffect(() => {
    if (!touchedRef.current && !open && state.paniers[0]) setOpen(state.paniers[0].id);
  }, [state.paniers, open]);

  /** Le scan : lit TOUS les marchés de chaque match pas encore commencé des jours
   *  choisis, garde la cote dans la bande (la plus proche du haut de bande),
   *  fabrique des paniers qui atteignent CHACUN la cote totale minimale. */
  async function run() {
    setBusy(true);
    setError(null);
    setNote(null);
    setMsg(`Serveur → 1xbet.ci / 1xbet.com · ${daysLabel(scanDays)}…`);
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 50_000);
      const res = await fetch("/api/xbet/scan", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...params, days: scanDays }),
        signal: ctrl.signal,
      }).catch(() => null);
      clearTimeout(t);
      const json = res
        ? ((await res.json().catch(() => null)) as {
              ok?: boolean;
              state?: XbetState;
              fallback?: boolean;
              error?: string;
            } | null)
        : null;
      if (json?.ok && json.state?.paniers?.length) {
        announce(json.state);
        return;
      }
      setMsg("Serveur bloqué par 1xBet. Scan depuis le téléphone…");
      const scan = await clientScrape({ ...params, days: scanDays }, (m) => setMsg(m));
      if (!scan.legs.length) {
        setError(
          scan.error ??
            json?.error ??
            "Aucune cote 1,01 atteignable. Réessaie — 1xBet bloque parfois quelques minutes.",
        );
        return;
      }
      const paniers = buildPaniers(scan.legs, scan.params, daysKey(scanDays));
      const local: XbetState = {
        day: daysKey(scanDays),
        days: scanDays,
        scannedAt: new Date().toISOString(),
        host: scan.host,
        pool: scan.legs.length,
        paniers,
        error: null,
      };
      saveLocalState(local);
      announce(local);
      try {
        await fetch("/api/xbet/ingest", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ legs: scan.legs, host: scan.host, params: scan.params, days: scanDays }),
        });
      } catch {
        /* local suffit */
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Scan interrompu");
    } finally {
      setBusy(false);
    }
  }

  function announce(next: XbetState) {
    touchedRef.current = false;
    setOpen(null);
    saveLocalState(next);
    setState(next);
    const used = next.paniers.reduce((a, p) => a + p.legs.length, 0);
    setMsg(
      next.paniers.length
        ? `${next.paniers.length} panier${next.paniers.length > 1 ? "s" : ""} ≥ ${oddsFr(params.minProduct)} · ${used}/${next.pool} matchs utilisés`
        : "Aucun panier — pas assez de matchs.",
    );
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

  return (
    <div className="space-y-4">
      <div>
        <p className="text-[11px] uppercase tracking-[0.28em] text-lime">{daysLabel(scanDays)}</p>
        <h1 className="mt-1 font-display text-3xl font-semibold">Tes combinés 1,01</h1>
        <p className="mt-2 text-xs text-mist">
          <span className="text-paper">{keyLabel(state.day)}</span>
          {state.host ? ` · ${new URL(state.host).hostname}` : ""}
          {state.scannedAt ? ` · scanné ${fmtKick(state.scannedAt)}` : ""} · {state.pool} matchs en bande
        </p>
      </div>

      {/* ── Scan (les réglages sont dans le ☰ en haut à gauche) ── */}
      <div className="space-y-3 rounded-3xl border border-white/10 bg-ink-800/50 p-4">
        <button
          type="button"
          disabled={busy}
          onClick={() => void run()}
          className="flex w-full items-center justify-center gap-2 rounded-full bg-lime py-3.5 text-sm font-semibold text-ink-950 disabled:opacity-60"
        >
          <Radar size={16} className={busy ? "animate-spin" : ""} />
          {busy ? "Scan en cours…" : "Scanner 1xBet"}
        </button>
        <p className="text-center text-xs text-mist">{msg}</p>
        <p className="text-center text-[11px] text-mist/80">
          Cible : <span className="text-paper">{daysLabel(scanDays)}</span> — change avec le calendrier en haut à
          droite (1 clic = date, 2 clics = plage).
        </p>
        {error && (
          <p className="rounded-xl border border-live/30 bg-live/10 px-3 py-2 text-xs text-live">{error}</p>
        )}
        <p className="text-[11px] leading-relaxed text-mist">
          Chaque panier vise <span className="text-lime">{oddsFr(params.minProduct)}</span> de cote totale minimum —
          sinon un seul panier regroupe tout. {params.maxLegs} sélections max (plafond 1xBet). Règles &amp; réglages :
          ☰ en haut à gauche.
        </p>
      </div>

      {/* ── État + purge des matchs commencés ── */}
      <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/8 bg-ink-800/40 px-4 py-3">
        <p className="text-xs text-mist">
          <span className="text-paper">
            {state.paniers.length} panier{state.paniers.length > 1 ? "s" : ""}
          </span>{" "}
          · un match commence → sa jambe saute, le reste reste jouable
        </p>
        <button
          type="button"
          disabled={busy}
          onClick={() => void refresh(true)}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-lime/40 px-3 py-1.5 text-[11px] font-semibold text-lime disabled:opacity-50"
        >
          <RefreshCw size={12} /> Actualiser
        </button>
      </div>
      {note && <p className="rounded-xl border border-white/8 bg-ink-800/40 px-3 py-2 text-xs text-mist">{note}</p>}

      {/* ── Paniers ── */}
      {state.paniers.map((b, i) => {
        const first = b.legs[0]?.kickoff;
        const last = b.legs[b.legs.length - 1]?.kickoff;
        const expanded = open === b.id;
        return (
          <article key={b.id} className="overflow-hidden rounded-3xl border border-white/10 bg-ink-800/60">
            <button
              type="button"
              onClick={() => {
                touchedRef.current = true;
                setOpen(expanded ? null : b.id);
              }}
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

      {!state.paniers.length && !busy && (
        <p className="rounded-2xl border border-white/8 bg-ink-800/40 p-4 text-center text-sm text-mist">
          Aucun panier — appuie sur <span className="text-lime">Scanner 1xBet</span> ci-dessus.
          {state.error && <span className="mt-1 block text-xs text-live">{state.error}</span>}
        </p>
      )}
    </div>
  );
}

function purgeNote(legs: number, supprimes: number, reduits: number): string {
  if (!legs && !supprimes && !reduits) return "À jour — aucun match commencé dans tes paniers.";
  const bits: string[] = [];
  if (legs) bits.push(`${legs} jambe${legs > 1 ? "s" : ""} retirée${legs > 1 ? "s" : ""} (match commencé)`);
  if (reduits) bits.push(`${reduits} panier${reduits > 1 ? "s" : ""} réduit${reduits > 1 ? "s" : ""}`);
  if (supprimes) bits.push(`${supprimes} panier${supprimes > 1 ? "s" : ""} supprimé${supprimes > 1 ? "s" : ""}`);
  return `${bits.join(" · ")} — cotes recalculées.`;
}

function preferNewer(local: XbetState | null, server: XbetState): XbetState {
  if (!local?.scannedAt) return server;
  if (!server.scannedAt) return local.paniers.length ? local : server;
  return +new Date(server.scannedAt) >= +new Date(local.scannedAt) ? server : local;
}
