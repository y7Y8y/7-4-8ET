"use client";

import { useEffect, useState } from "react";
import { clockOf } from "@/lib/clock";
import type { MatchStatus } from "@/lib/types";

export function LiveMinute({ kickoff }: { kickoff: string }) {
  const [clock, setClock] = useState(() => clockOf(kickoff));
  useEffect(() => {
    const id = setInterval(() => setClock(clockOf(kickoff)), 15_000);
    return () => clearInterval(id);
  }, [kickoff]);
  if (clock.status === "scheduled") return null;
  if (clock.status === "ht") return <span className="text-lime">MT</span>;
  if (clock.status === "finished") return <span className="text-mist">FT</span>;
  return <span className="tabular text-live">{clock.minute}&apos;</span>;
}

export function StatusChip({ status }: { status: MatchStatus }) {
  if (status === "live") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-live/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-live">
        <i className="live-dot inline-block h-1.5 w-1.5 rounded-full bg-live" />
        Live
      </span>
    );
  }
  if (status === "ht") {
    return (
      <span className="rounded-full bg-lime/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-lime">
        Mi-temps
      </span>
    );
  }
  if (status === "finished") {
    return (
      <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-mist">
        Terminé
      </span>
    );
  }
  return (
    <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-mist">
      À venir
    </span>
  );
}
