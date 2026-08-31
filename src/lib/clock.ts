import type { Match, MatchEvent, MatchStatus } from "./types";

/** HT lasts 15 minutes. Extra time is not modelled here. */
export function clockOf(kickoffIso: string, now = Date.now()) {
  const elapsed = (now - new Date(kickoffIso).getTime()) / 60000;
  if (elapsed < 0) {
    return { status: "scheduled" as MatchStatus, minute: null as number | null };
  }
  if (elapsed < 45) {
    return { status: "live" as MatchStatus, minute: Math.max(1, Math.floor(elapsed) + 1) };
  }
  if (elapsed < 60) {
    return { status: "ht" as MatchStatus, minute: 45 };
  }
  if (elapsed < 105) {
    const m = Math.min(90, Math.floor(elapsed - 15) + 1);
    return { status: "live" as MatchStatus, minute: m };
  }
  if (elapsed < 108) {
    return { status: "live" as MatchStatus, minute: 90 };
  }
  return { status: "finished" as MatchStatus, minute: 90 };
}

export function eventsUntil(events: MatchEvent[], minute: number | null, status: MatchStatus) {
  if (status === "scheduled") return [];
  const cap = minute ?? 90;
  const stop = status === "finished" ? 200 : cap;
  return events.filter((e) => e.minute <= stop);
}

export function scoreFrom(events: MatchEvent[]) {
  let home = 0;
  let away = 0;
  for (const e of events) {
    if (e.type === "goal" || e.type === "penalty" || e.type === "own_goal") {
      if (e.type === "own_goal") {
        if (e.team === "home") away += 1;
        else home += 1;
      } else if (e.team === "home") home += 1;
      else away += 1;
    }
  }
  return { home, away };
}

export function hydrate<T extends Match>(match: T, now = Date.now()): T {
  const clock = clockOf(match.kickoff, now);
  const events = eventsUntil(match.events, clock.minute, clock.status);
  const score =
    clock.status === "scheduled" ? { home: null, away: null } : scoreFrom(events);
  return {
    ...match,
    status: clock.status,
    minute: clock.minute,
    events,
    score,
  };
}
