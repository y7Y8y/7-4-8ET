"use client";

import { useState } from "react";
import { Menu, RotateCcw, X } from "lucide-react";
import { useScanConfig } from "./scan-config";
import { oddsFr } from "@/lib/format";

export function ScanDrawer() {
  const { params, patchParams, resetParams } = useScanConfig();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        aria-label="Règles du scan et réglages"
        onClick={() => setOpen(true)}
        className="rounded-xl border border-white/10 p-2 text-mist transition hover:border-lime/40 hover:text-lime"
      >
        <Menu size={18} />
      </button>

      {open && (
        <div className="fixed inset-0 z-50">
          <button
            type="button"
            aria-label="Fermer"
            onClick={() => setOpen(false)}
            className="absolute inset-0 w-full bg-black/70 backdrop-blur-sm"
          />
          <aside className="drawer-panel absolute inset-y-0 left-0 flex w-[88%] max-w-sm flex-col overflow-y-auto border-r border-white/10 bg-ink-900 p-5 pt-[max(1.25rem,env(safe-area-inset-top))]">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-display text-xl font-semibold">Règles &amp; réglages</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Fermer le tiroir"
                className="rounded-xl border border-white/10 p-2 text-mist hover:text-paper"
              >
                <X size={16} />
              </button>
            </div>

            <p className="mt-4 text-[10px] uppercase tracking-[0.24em] text-lime">Règles du scan</p>
            <ul className="mt-2 space-y-2 text-xs leading-relaxed text-mist">
              <li className="rounded-xl border border-white/8 bg-ink-800/50 px-3 py-2">
                <span className="text-paper">Pré-match uniquement</span> — jamais un match commencé, ni dans les{" "}
                {params.bufferMin} min qui viennent (jamais de live).
              </li>
              <li className="rounded-xl border border-white/8 bg-ink-800/50 px-3 py-2">
                <span className="text-paper">Tous les marchés</span> de chaque match sont lus ; une seule cote est
                gardée par match (la plus proche de 1,01 dans la bande).
              </li>
              <li className="rounded-xl border border-white/8 bg-ink-800/50 px-3 py-2">
                Chaque panier atteint au minimum{" "}
                <span className="text-lime">{oddsFr(params.minProduct)}</span> de cote totale — sinon un seul panier
                regroupe tout, jamais de panier à 1,05.
              </li>
              <li className="rounded-xl border border-white/8 bg-ink-800/50 px-3 py-2">
                <span className="text-paper">{params.maxLegs} sélections max</span> par panier (plafond 1xBet) ·{" "}
                {params.maxPaniers} paniers max par scan.
              </li>
              <li className="rounded-xl border border-white/8 bg-ink-800/50 px-3 py-2">
                Un match commence → <span className="text-paper">son panier saute</span> (purge auto à l&apos;ouverture
                ou via Actualiser).
              </li>
            </ul>

            <p className="mt-5 text-[10px] uppercase tracking-[0.24em] text-lime">Paramètres</p>
            <div className="mt-2 grid grid-cols-2 gap-3">
              <label className="text-xs text-mist">
                Cote min (bande)
                <input
                  className="field mt-1"
                  type="number"
                  step="0.001"
                  min={1}
                  max={1.05}
                  value={params.oddMin}
                  onChange={(e) => patchParams({ oddMin: Number(e.target.value) })}
                />
              </label>
              <label className="text-xs text-mist">
                Cote max (bande)
                <input
                  className="field mt-1"
                  type="number"
                  step="0.001"
                  min={1}
                  max={1.05}
                  value={params.oddMax}
                  onChange={(e) => patchParams({ oddMax: Number(e.target.value) })}
                />
              </label>
              <label className="text-xs text-mist">
                Cote totale min / panier
                <input
                  className="field mt-1"
                  type="number"
                  step="0.05"
                  min={1.01}
                  max={100}
                  value={params.minProduct}
                  onChange={(e) => patchParams({ minProduct: Number(e.target.value) })}
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
                  onChange={(e) => patchParams({ maxLegs: Math.min(50, Number(e.target.value) || 50) })}
                />
              </label>
              <label className="text-xs text-mist">
                Paniers max / scan
                <input
                  className="field mt-1"
                  type="number"
                  min={1}
                  max={8}
                  value={params.maxPaniers}
                  onChange={(e) => patchParams({ maxPaniers: Number(e.target.value) || 5 })}
                />
              </label>
              <label className="text-xs text-mist">
                Buffer coup d&apos;envoi (min)
                <input
                  className="field mt-1"
                  type="number"
                  min={0}
                  max={720}
                  value={params.bufferMin}
                  onChange={(e) => patchParams({ bufferMin: Math.max(0, Number(e.target.value) || 0) })}
                />
              </label>
            </div>

            <button
              type="button"
              onClick={resetParams}
              className="mx-auto mt-5 inline-flex items-center gap-1.5 rounded-full border border-white/15 px-4 py-2 text-xs text-mist hover:text-paper"
            >
              <RotateCcw size={13} /> Réinitialiser
            </button>
            <p className="mt-3 text-center text-[11px] text-mist/70">
              Les réglages restent sur le téléphone (localStorage).
            </p>
          </aside>
        </div>
      )}
    </>
  );
}
