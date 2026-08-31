"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Radar } from "lucide-react";
import { buildPaniers } from "@/lib/xbet/pack";
import { clientScrape } from "@/lib/xbet/client-scan";
import { loadParams, saveLocalState, saveParams } from "@/lib/xbet/local";
import { SCAN_DEFAULTS, type ScanParams, type XbetState } from "@/lib/xbet/types";

export function ScanDesk() {
  const router = useRouter();
  const [params, setParams] = useState<ScanParams>(SCAN_DEFAULTS);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("Prêt.");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setParams(loadParams());
  }, []);

  function patch(p: Partial<ScanParams>) {
    const next = { ...params, ...p };
    setParams(next);
    saveParams(next);
  }

  async function run() {
    setBusy(true);
    setError(null);
    setMsg("Serveur → 1xbet.ci / 1xbet.com…");
    try {
      // Le serveur a un budget interne de 40 s — on lui laisse 50 s avant d'abandonner.
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
        setMsg(`${json.state.paniers.length} paniers prêts.`);
        router.push("/");
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
        setBusy(false);
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
      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Scan interrompu");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[11px] uppercase tracking-[0.28em] text-lime">Pré-match 1xBet</p>
        <h1 className="mt-1 font-display text-3xl font-semibold">Scanner</h1>
        <p className="mt-2 text-sm text-mist">
          Un bouton. On lit 1xBet depuis ce téléphone, on fabrique les paniers. Ensuite onglet Paniers → Copier → tu colles sur 1xBet toi-même.
        </p>
      </div>

      <div className="rounded-3xl border border-white/10 bg-ink-800/50 p-4">
        <p className="text-[10px] uppercase tracking-[0.2em] text-mist">Bande</p>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <label className="text-xs text-mist">
            Min
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
            Max
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
        <p className="mt-3 text-xs text-mist">
          50 × 1,01 ≈ <span className="text-lime">1,64</span> · une cote par match · purge si un match a commencé
        </p>
      </div>

      <button
        type="button"
        disabled={busy}
        onClick={() => void run()}
        className="flex w-full items-center justify-center gap-2 rounded-full bg-lime py-3.5 text-sm font-semibold text-ink-950 disabled:opacity-60"
      >
        <Radar size={16} className={busy ? "animate-spin" : ""} />
        {busy ? "Scan en cours…" : "Lancer le scan"}
      </button>
      <p className="text-center text-xs text-mist">{msg}</p>
      {error && <p className="rounded-xl border border-live/30 bg-live/10 px-3 py-2 text-xs text-live">{error}</p>}
    </div>
  );
}
