const PARIS = "Europe/Paris";

export function fmtTime(iso: string) {
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: PARIS,
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function fmtDate(iso: string, opt: Intl.DateTimeFormatOptions = {}) {
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: PARIS,
    weekday: "short",
    day: "numeric",
    month: "short",
    ...opt,
  }).format(new Date(iso));
}

export function fmtDateLong(iso: string) {
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: PARIS,
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(iso));
}

export function ymd(d: Date | string = new Date()) {
  const dt = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat("en-CA", { timeZone: PARIS }).format(dt);
}

export function addDays(isoDay: string, n: number) {
  const d = new Date(`${isoDay}T12:00:00+02:00`);
  d.setDate(d.getDate() + n);
  return ymd(d);
}

export function pct(n: number) {
  return `${Math.round(n * 100)}%`;
}

export function oddsFr(n: number) {
  return n.toFixed(2).replace(".", ",");
}

export function implied(decimal: number) {
  return 1 / decimal;
}

export function clsx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}
