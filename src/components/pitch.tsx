import type { LineupPlayer } from "@/lib/types";

export function Pitch({
  formation,
  players,
  flip = false,
  accent = "lime",
}: {
  formation: string;
  players: LineupPlayer[];
  flip?: boolean;
  accent?: "lime" | "live";
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#0c3b24]">
      <div
        className="absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            "repeating-linear-gradient(90deg, transparent 0 36px, rgba(255,255,255,.04) 36px 72px)",
        }}
      />
      <div className="absolute left-1/2 top-1/2 h-24 w-24 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/20" />
      <div className="absolute left-1/2 top-0 h-full w-px bg-white/15" />
      <div className="absolute inset-x-8 top-0 h-16 border-x border-b border-white/15" />
      <div className="absolute inset-x-8 bottom-0 h-16 border-x border-t border-white/15" />
      <p className="absolute left-3 top-2 z-10 text-[10px] uppercase tracking-[0.2em] text-white/60">
        {formation}
      </p>
      <div className="relative aspect-[3/4] w-full">
        {players.map((p) => {
          const y = flip ? 100 - p.y : p.y;
          return (
            <div
              key={`${p.number}-${p.name}`}
              className="absolute -translate-x-1/2 -translate-y-1/2 text-center"
              style={{ left: `${p.x}%`, top: `${y}%` }}
            >
              <span
                className={`mx-auto grid h-8 w-8 place-items-center rounded-full text-[11px] font-bold ${
                  accent === "lime" ? "bg-lime text-ink-950" : "bg-live text-white"
                }`}
              >
                {p.number}
              </span>
              <span className="mt-1 block max-w-[72px] truncate text-[10px] text-white">
                {p.name.split(" ").slice(-1)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
