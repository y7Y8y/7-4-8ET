"use client";

import { useState } from "react";
import { oddsFr } from "@/lib/format";
import { ticketLine, x1bet } from "@/lib/model";
import type { Match } from "@/lib/types";

export function X1Ticket({ match }: { match: Match }) {
  const q = x1bet(match);
  const pred = match.prediction;
  const side = pred?.pick ?? "home";
  const line = ticketLine(match, side);
  const [copied, setCopied] = useState(false);
  if (!q || !line) return null;

  const text = `1xBet · ${match.home.name} vs ${match.away.name}\n${line.label} @ ${oddsFr(line.odds)}\n+2.5 ${q.over25 ? oddsFr(q.over25) : "—"} · −2.5 ${q.under25 ? oddsFr(q.under25) : "—"}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="rounded-2xl border border-lime/30 bg-ink-800/70 p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] uppercase tracking-[0.22em] text-lime">Ticket 1xBet</p>
        <span className="text-[10px] uppercase tracking-wider text-mist">À recopier · 18+</span>
      </div>
      <p className="mt-2 font-display text-lg leading-tight">
        {match.home.short} × {match.away.short}
      </p>
      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        <Pick lab={`1 ${match.home.short}`} n={q.home} on={side === "home"} />
        <Pick lab="X" n={q.draw} on={side === "draw"} />
        <Pick lab={`2 ${match.away.short}`} n={q.away} on={side === "away"} />
      </div>
      {(q.over25 || q.under25) && (
        <p className="mt-3 text-xs text-mist">
          +2,5 {q.over25 ? oddsFr(q.over25) : "—"} · −2,5 {q.under25 ? oddsFr(q.under25) : "—"}
        </p>
      )}
      <p className="mt-3 text-[11px] leading-relaxed text-mist">
        NINETY ne place pas le pari. Copie le ticket, ouvre 1xBet, saisis-le toi-même. Les cotes
        bougent. Tu peux tout perdre.
      </p>
      <button
        type="button"
        onClick={copy}
        className="mt-3 w-full rounded-full bg-lime py-2 text-sm font-semibold text-ink-950"
      >
        {copied ? "Copié" : "Copier le ticket"}
      </button>
    </div>
  );
}

function Pick({ lab, n, on }: { lab: string; n: number; on: boolean }) {
  return (
    <div className={`rounded-xl px-2 py-3 ${on ? "bg-lime text-ink-950" : "bg-white/5"}`}>
      <div className="text-[10px] uppercase tracking-wider opacity-70">{lab}</div>
      <div className="mt-1 font-score text-2xl tabular">{oddsFr(n)}</div>
    </div>
  );
}
