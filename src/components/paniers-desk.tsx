"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronDown, Copy, Radar, RefreshCw, Settings2, Trash2 } from "lucide-react";
import { fmtKick, odds3 } from "@/lib/format";
import { buildPaniers, couponText, purgeStarted } from "@/lib/xbet/pack";
import { clientScrape } from "@/lib/xbet/client-scan";
import { loadLocalState, loadParams, saveLocalState, saveParams } from "@/lib/xbet/local";
import { SCAN_DEFAULTS, type Panier, type ScanParams, type XbetState } from "@/lib/xbet/types";

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
  const [params, setParams] = useState<ScanParams>(SCAN_DEFAULTS);
  const [showParams, setShowParams] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("Prêt.");
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  /** Recharge l'état + purge les matchs commencés. announce=true → message visible. */
  const refresh = useCallback(async (announce: boolean) => {
    try {
      const res = await fetch("/api/xbet/paniers", { cache: "no-store" });
      const json = (await res.json()) as { state?: XbetState };
      if (json.state) {
        const merged = preferNewer(loadLocalState(), json.state);
        const before = merged.paniers.length;
        const cleaned = { ...merged, paniers: purgeStarted(merged.paniers) };
        const removed = before - cleaned.paniers.length;
        setState(cleaned);
        saveLocalState(cleaned);
        if (announce) {
          setNote(
            removed > 0
              ? `${removed} panier${removed > 1 ? "s" : ""} retiré${removed > 1 ? "s" : ""} — un match a commencé.`
              : "À jour — aucun match commencé dans tes paniers.",
          );
        }
      }
    } catch {
      const local = loadLocalState();
      if (local) {
        const cleaned = { ...local, paniers: purgeStarted(local.paniers) };
        setState(cleaned);
        saveLocalState(cleaned);
      }
    }
  }, []);

  useEffect(() => {
    setParams(loadParams());
    const local = loadLocalState();
    if (local) setState(local);
    void refresh(false);
  }, [refresh]);

  useEffect(() => {
    if (!open && state.paniers[0]) setOpen(state.paniers[0].id);
  }, [state.paniers, open]);

  function patch(p: Partial<ScanParams>) {
    const next = { ...params, ...p };
    setParams(next);
    saveParams(next);
  }

  /** Le scan : lit TOUS les marchés de chaque match pas encore commencé,
   *  en garde la cote dans la bande (la plus proche de 1,01), fabrique les paniers. */
  async function run() {
    setBusy(true);
    setError(null);
    setNote(null);
    setMsg("Serveur → 1xbet.ci / 1xbet.com…");
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 50_000);
      const res = await fetch("/api/xbet/scan", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(params),
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
        saveLocalState(json.state);
        setState(json.state);
        setMsg(`${json.state.paniers.length} paniers prêts.`);
        return;
      }
      setMsg("Serveur bloqué par 1xBet. Scan depuis le téléphone…");
      const scan = await clientScrape(params, (m) => setMsg(m));
      if (!scan.legs.length) {
        setError(
          scan.error ??
            json?.error ??
            "Aucune cote 1,01 atteignable. Réessaie — 1xBet bloque parfois quelques minutes.",
        );
        return;
      }
      const paniers = buildPaniers(scan.legs, params);
      const local: XbetState = {
        day: new Date().toISOString().slice(0, 10),
        scannedAt: new Date().toISOString(),
        host: scan.host,
        pool: scan.legs.length,
        paniers,
        error: null,
      };
      saveLocalState(local);
      setState(local);
      try {
        await fetch("/api/xbet/ingest", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ legs: scan.legs, host: scan.host, params }),
        });
      } catch {
        /* local suffit */
      }
      setMsg(`${paniers.length} paniers · ${scan.legs.length} matchs`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Scan interrompu");
    } finally {
      setBusy(false);
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

  return (
    <div className="space-y-4">
      <div>
        <p className="text-[11px] uppercase tracking-[0.28em] text-lime">Aujourd&apos;hui</p>
        <h1 className="mt-1 font-display text-3xl font-semibold">Tes combinés 1,01</h1>
        <p className="mt-2 text-xs text-mist">
          {state.host ? new URL(state.host).hostname : "1xBet"}
          {state.scannedAt ? ` · scanné ${fmtKick(state.scannedAt)}` : ""} · {state.pool} matchs en bande
        </p>
      </div>

      {/* ── Scanner (fusionné ici, plus d'onglet séparé) ── */}
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
        {error && (
          <p className="rounded-xl border border-live/30 bg-live/10 px-3 py-2 text-xs text-live">{error}</p>
        )}
        <button
          type="button"
          onClick={() => setShowParams((v) => !v)}
          className="mx-auto flex items-center gap-1.5 text-[11px] text-mist"
        >
          <Settings2 size={12} /> Réglages du scan
        </button>
        {showParams && (
          <div className="grid grid-cols-2 gap-3">
            <label className="text-xs text-mist">
              Cote min
              <input
                className="field mt-1"
                type="number"
                step="0.001"
                min={1}
                max={1.05}
                value={params.oddMin}
                onChange={(e) => patch({ oddMin: Number(e.target.value) })}
              />
            </label>
            <label className="text-xs text-mist">
              Cote max
              <input
                className="field mt-1"
                type="number"
                step="0.001"
                min={1}
                max={1.05}
                value={params.oddMax}
                onChange={(e) => patch({ oddMax: Number(e.target.value) })}
              />
            </label>
            <label className="text-xs text-mist">
              Sélections / panier
              <input
                className="field mt-1"
                type="number"
                min={1}
                max={50}
                value={params.maxLegs}
                onChange={(e) => patch({ maxLegs: Math.min(50, Number(e.target.value) || 50) })}
              />
            </label>
            <label className="text-xs text-mist">
              Paniers / jour
              <input
                className="field mt-1"
                type="number"
                min={1}
                max={8}
                value={params.maxPaniers}
                onChange={(e) => patch({ maxPaniers: Number(e.target.value) || 5 })}
              />
            </label>
          </div>
        )}
        <p className="text-[11px] leading-relaxed text-mist">
          Lit tous les marchés de chaque match <span className="text-paper">pas encore commencé</span> (jamais
          en live), garde la cote la plus proche de 1,01. 50 × 1,01 ≈ <span className="text-lime">1,64</span>.
        </p>
      </div>

      {/* ── État + purge des matchs commencés ── */}
      <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/8 bg-ink-800/40 px-4 py-3">
        <p className="text-xs text-mist">
          <span className="text-paper">{state.paniers.length} / 5 paniers</span> · un match commence → son panier
          saute
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

      {!state.paniers.length && !busy && (
        <p className="rounded-2xl border border-white/8 bg-ink-800/40 p-4 text-center text-sm text-mist">
          Aucun panier — appuie sur <span className="text-lime">Scanner 1xBet</span> ci-dessus.
          {state.error && <span className="mt-1 block text-xs text-live">{state.error}</span>}
        </p>
      )}
    </div>
  );
}

function preferNewer(local: XbetState | null, server: XbetState): XbetState {
  if (!local?.scannedAt) return server;
  if (!server.scannedAt) return local.paniers.length ? local : server;
  return +new Date(server.scannedAt) >= +new Date(local.scannedAt) ? server : local;
}
