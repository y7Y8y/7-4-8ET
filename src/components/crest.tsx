"use client";

import { useState } from "react";
import type { Team } from "@/lib/types";

export function Crest({
  team,
  size = 28,
}: {
  team: Pick<Team, "name" | "short" | "crest">;
  size?: number;
}) {
  const [fail, setFail] = useState(false);
  if (fail) {
    return (
      <span
        className="grid place-items-center rounded-full bg-ink-700 text-[10px] font-semibold tracking-wide text-paper"
        style={{ width: size, height: size }}
        title={team.name}
      >
        {team.short.slice(0, 3)}
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={team.crest}
      alt=""
      width={size}
      height={size}
      className="object-contain"
      style={{ width: size, height: size }}
      onError={() => setFail(true)}
    />
  );
}
