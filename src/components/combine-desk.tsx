"use client";

import { useEffect, useMemo, useState } from "react";
import { fmtDate, fmtTime, oddsFr } from "@/lib/format";
import { buildBaskets, couponText, neededLegs } from "@/lib/combine/pack";
import { DEFAULT_PARAMS, type CombineLeg, type CombineParams } from "@/lib/combine/types";

type Payload = {
  scan: { scannedAt: string; source: string; pool: number; liveRejected: number };
  params: CombineParams;
  legs: CombineLeg[];
};

export function CombineDesk() {
  const [params, setParams] = useState<CombineParams>(DEFAULT_PARAMS);
  const [legs, setLegs] = useState<CombineLeg[]>([]);
  const [source, setSource] = useState("demo");
  const [scannedAt, setScannedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState<"10" | "5" | null>(null);
  const [which, setWhich] = useState<"primary" | "fallback">("primary");

  async function load(demo = false) {
    setLoading(true);
    setErr(null);
    try {
      const q = new URLSearchParams({
        demo: demo ? "1" : "0",
        oddMin: String(params.oddMin),
        oddMax: String(params.oddMax),
        target: String(params.target),
        fallback: String(params.fallback),
        bufferMin: String(params.bufferMin),
        minStake: String(params.minStake),
      });
      const res = await fetch(`/api/combine?${q}`, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as Payload;
      setLegs(data.legs);
      setSource(data.scan.source);
      setScannedAt(data.scan.scannedAt);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "scan impossible");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load(true);
    // first paint with demo so the desk is usable even si 1xBet API est down
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { filtered, primary, fallback } = useMemo(
    () => buildBaskets(legs, params),
    [legs, params],
  );
  const basket = which === "primary" ? primary : fallback;
  const avg = filtered.length ? filtered.reduce((s, l) => s + l.odd, 0) / filtered.length : 1.01;

  function patch<K extends keyof CombineParams>(k: K, v: CombineParams[K]) {
    setParams((p) => ({ ...p, [k]: v }));
  }

  async function copy() {
    const text = couponText(basket, params);
    await navigator.clipboard.writeText(text);
    setCopied(which === "primary" ? "10" : "5");
    setTimeout(() => setCopied(null), 1600);
  }

  return (
    <div className="space-y-6">
      <p className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-xs leading-relaxed text-mist">
        Proprio unique. Pré-match uniquement. Cote dans [{params.oddMin} – {params.oddMax}].{" "}
        <span className="text-paper">Aucun pari n&apos;est envoyé à 1xBet.</span> Tu copies le
        panier, tu le saisis à la main, mise de génération {params.minStake} {params.currency}. 18+.
      </p>

      <section className="grid gap-3 rounded-2xl border border-white/8 bg-ink-800/50 p-4 md:grid-cols-4">
        <Field label={`Cote min`}>
          <input
            type="number"
            step="0.001"
            min={1.001}
            max={1.05}
            value={params.oddMin}
            onChange={(e) => patch("oddMin", Number(e.target.value))}
            className="field"
          />
        </Field>
        <Field label="Cote max">
          <input
            type="number"
            step="0.001"
            min={1.001}
            max={1.05}
            value={params.oddMax}
            onChange={(e) => patch("oddMax", Number(e.target.value))}
            className="field"
          />
        </Field>
        <Field label="Cible">
          <input
            type="number"
            step="0.5"
            min={1.2}
            value={params.target}
            onChange={(e) => patch("target", Number(e.target.value))}
            className="field"
          />
        </Field>
        <Field label="Secours">
          <input
            type="number"
            step="0.5"
            min={1.2}
            value={params.fallback}
            onChange={(e) => patch("fallback", Number(e.target.value))}
            className="field"
          />
        </Field>
        <Field label="Marge avant KO (min)">
          <input
            type="number"
            min={5}
            value={params.bufferMin}
            onChange={(e) => patch("bufferMin", Number(e.target.value))}
            className="field"
          />
        </Field>
        <Field label={`Mise génération (${params.currency})`}>
          <input
            type="number"
            min={1}
            value={params.minStake}
            onChange={(e) => patch("minStake", Number(e.target.value))}
            className="field"
          />
        </Field>
        <div className="flex items-end gap-2 md:col-span-2">
          <button
            type="button"
            onClick={() => void load(false)}
            className="rounded-full bg-lime px-4 py-2 text-sm font-semibold text-ink-950"
          >
            Scanner 1xBet
          </button>
          <button
            type="button"
            onClick={() => void load(true)}
            className="rounded-full bg-white/10 px-4 py-2 text-sm text-paper"
          >
            Recharger démo
          </button>
        </div>
      </section>

      <div className="grid gap-3 sm:grid-cols-4">
        <Stat k="Pool 1,01" v={String(filtered.length)} d={loading ? "scan…" : source} />
        <Stat
          k={`Pour viser ${params.target}`}
          v={`~${neededLegs(avg, params.target)}`}
          d={`moy. ${avg.toFixed(3)}`}
        />
        <Stat
          k={`Panier ${params.target}`}
          v={primary.ok ? primary.product.toFixed(3) : "incomplet"}
          d={`${primary.legs.length} jambes`}
        />
        <Stat
          k={`Secours ${params.fallback}`}
          v={fallback.ok ? fallback.product.toFixed(3) : "incomplet"}
          d={`${fallback.legs.length} jambes`}
        />
      </div>
      {scannedAt && (
        <p className="text-[11px] uppercase tracking-[0.18em] text-mist">
          Scan {new Date(scannedAt).toLocaleTimeString("fr-FR")} · source {source}
          {err ? ` · ${err}` : ""}
        </p>
      )}

      <div className="flex gap-2">
        <Tab on={which === "primary"} onClick={() => setWhich("primary")}>
          Cible {params.target} {primary.ok ? "✓" : "· manque"}
        </Tab>
        <Tab on={which === "fallback"} onClick={() => setWhich("fallback")}>
          Secours {params.fallback} {fallback.ok ? "✓" : "· manque"}
        </Tab>
      </div>

      <section className="rounded-2xl border border-lime/25 bg-ink-800/60 p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[10px] uppercase tracking-[0.22em] text-lime">Panier 1xBet</p>
            <p className="mt-1 font-display text-3xl">
              {basket.product.toFixed(4)}
              <span className="ml-3 text-base text-mist">/ {basket.target}</span>
            </p>
            <p className="mt-1 text-xs text-mist">
              {basket.legs.length} sélections · une par match · hors live · hors matchs déjà
              commencés
              {!basket.ok && ` · facteur manquant ×${basket.missingFactor.toFixed(2)}`}
            </p>
          </div>
          <button
            type="button"
            onClick={() => void copy()}
            disabled={!basket.legs.length}
            className="rounded-full bg-lime px-5 py-2 text-sm font-semibold text-ink-950 disabled:opacity-40"
          >
            {copied ? "Copié" : "Copier le coupon"}
          </button>
        </div>
        {!basket.ok && (
          <p className="mt-3 text-sm text-live">
            Pas assez de 1,01 pré-match pour {basket.target}.{" "}
            {which === "primary"
              ? `Passe sur le secours ${params.fallback}, ou élargis la bande / attends le scan 1xBet.`
              : "Le pool est trop court. Relance un scan ou baisse la cible."}
          </p>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        <section className="rounded-2xl border border-white/8">
          <header className="border-b border-white/8 px-4 py-3 text-[11px] uppercase tracking-[0.18em] text-mist">
            Pool filtré · {filtered.length}
          </header>
          <div className="max-h-[480px] overflow-auto">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-ink-900 text-[10px] uppercase tracking-wider text-mist">
                <tr>
                  <th className="px-3 py-2">KO</th>
                  <th className="px-3 py-2">Match</th>
                  <th className="px-3 py-2">Marché</th>
                  <th className="px-3 py-2">Cote</th>
                </tr>
              </thead>
              <tbody>
                {filtered.slice(0, 400).map((l) => (
                  <tr key={l.id} className="border-t border-white/5">
                    <td className="whitespace-nowrap px-3 py-2 tabular text-mist">
                      {fmtDate(l.kickoff)} {fmtTime(l.kickoff)}
                    </td>
                    <td className="px-3 py-2">
                      <div className="text-paper">
                        {l.home} × {l.away}
                      </div>
                      <div className="text-[10px] text-mist">
                        {l.league}
                        {l.source === "demo" ? " · démo" : ""}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-mist">
                      {l.market}
                      <div className="text-paper">{l.pick}</div>
                    </td>
                    <td className="px-3 py-2 font-score text-lg text-lime">{oddsFr(l.odd)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-2xl border border-white/8">
          <header className="border-b border-white/8 px-4 py-3 text-[11px] uppercase tracking-[0.18em] text-mist">
            Coupon · {basket.legs.length} jambes
          </header>
          <ol className="max-h-[480px] overflow-auto p-3 text-xs">
            {basket.legs.map((l, i) => (
              <li key={l.id} className="flex gap-3 border-b border-white/5 py-2">
                <span className="w-8 tabular text-mist">{String(i + 1).padStart(3, "0")}</span>
                <span className="flex-1">
                  <span className="text-paper">
                    {l.home} × {l.away}
                  </span>
                  <span className="mt-0.5 block text-mist">
                    {l.market} · {l.pick}
                  </span>
                </span>
                <span className="font-score text-lime">{l.odd.toFixed(3)}</span>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-[10px] uppercase tracking-[0.16em] text-mist">
      {label}
      <div className="mt-1">{children}</div>
    </label>
  );
}

function Stat({ k, v, d }: { k: string; v: string; d: string }) {
  return (
    <div className="rounded-2xl border border-white/8 bg-ink-800/40 px-4 py-3">
      <p className="text-[10px] uppercase tracking-[0.18em] text-mist">{k}</p>
      <p className="mt-1 font-display text-2xl">{v}</p>
      <p className="text-[11px] text-mist">{d}</p>
    </div>
  );
}

function Tab({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-4 py-1.5 text-sm ${on ? "bg-lime text-ink-950" : "bg-white/5 text-mist"}`}
    >
      {children}
    </button>
  );
}
