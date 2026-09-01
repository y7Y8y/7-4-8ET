"use client";

import { useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, X } from "lucide-react";
import { useScanConfig } from "./scan-config";
import { addDays, ymd } from "@/lib/format";
import { daysLabel, expandRange, MAX_DAYS } from "@/lib/xbet/days";

const WEEKDAYS = ["lun", "mar", "mer", "jeu", "ven", "sam", "dim"];

function monthOf(day: string) {
  return day.slice(0, 7); // YYYY-MM
}

function shiftMonth(month: string, n: number) {
  const d = new Date(`${month}-01T12:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + n);
  return d.toISOString().slice(0, 7);
}

/** Grille du mois affiché : 6 semaines commençant lundi, en jours ISO. */
function grid(month: string): string[] {
  const first = new Date(`${month}-01T12:00:00Z`);
  const offset = (first.getUTCDay() + 6) % 7; // lundi = 0
  const start = new Date(first.getTime() - offset * 86_400_000);
  return Array.from({ length: 42 }, (_, i) => new Date(start.getTime() + i * 86_400_000).toISOString().slice(0, 10));
}

export function DayPicker() {
  const { days, setDays } = useScanConfig();
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState<string>(() => monthOf(ymd()));

  const today = ymd();
  const minDay = today;
  const maxDay = addDays(today, MAX_DAYS - 1);
  const cells = useMemo(() => grid(month), [month]);
  const label = days.length ? daysLabel(days) : "aujourd’hui";
  const count = days.length;

  /** 1er clic : date simple · 2e clic postérieur : plage · trop loin : nouveau départ. */
  function tap(iso: string) {
    if (iso < minDay || iso > maxDay) return;
    const start = days[0];
    if (!start || iso <= start) {
      setDays([iso]);
      return;
    }
    const span = Math.round((Date.parse(iso) - Date.parse(start)) / 86_400_000);
    if (span >= MAX_DAYS) {
      setDays([iso]);
      return;
    }
    setDays(expandRange(start, iso));
  }

  return (
    <div className="relative">
      <button
        type="button"
        aria-label="Choisir le ou les jours du scan"
        onClick={() => setOpen((v) => !v)}
        className={`relative inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-2 text-xs transition ${
          count > 1 ? "border-lime/50 bg-lime/10 text-lime" : "border-white/10 text-mist hover:border-lime/40 hover:text-lime"
        }`}
      >
        <CalendarDays size={16} />
        <span className="max-w-[92px] truncate">{label}</span>
      </button>

      {open && (
        <div className="absolute right-0 top-[calc(100%+8px)] z-50">
          <button
            type="button"
            aria-label="Fermer le calendrier"
            className="fixed inset-0 z-40 cursor-default"
            onClick={() => setOpen(false)}
          />
          <div className="relative z-50 w-[300px] rounded-2xl border border-white/12 bg-ink-900 p-4 shadow-2xl shadow-black/60">
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                aria-label="Mois précédent"
                disabled={month <= monthOf(minDay)}
                onClick={() => setMonth((m) => shiftMonth(m, -1))}
                className="rounded-lg border border-white/10 p-1.5 text-mist disabled:opacity-30"
              >
                <ChevronLeft size={14} />
              </button>
              <p className="text-sm font-semibold capitalize">
                {new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric", timeZone: "UTC" }).format(
                  new Date(`${month}-01T12:00:00Z`),
                )}
              </p>
              <button
                type="button"
                aria-label="Mois suivant"
                disabled={month >= monthOf(maxDay)}
                onClick={() => setMonth((m) => shiftMonth(m, 1))}
                className="rounded-lg border border-white/10 p-1.5 text-mist disabled:opacity-30"
              >
                <ChevronRight size={14} />
              </button>
            </div>

            <div className="mt-3 grid grid-cols-7 gap-1 text-center text-[10px] uppercase tracking-wide text-mist/70">
              {WEEKDAYS.map((d) => (
                <span key={d}>{d}</span>
              ))}
            </div>
            <div className="mt-1 grid grid-cols-7 gap-1">
              {cells.map((iso) => {
                const disabled = iso < minDay || iso > maxDay;
                const first = days[0];
                const last = days[days.length - 1];
                const isEdge = !!first && (iso === first || iso === last);
                const inRange = !!first && last !== first && iso > first && iso < last;
                const other = iso.slice(0, 7) !== month;
                return (
                  <button
                    key={iso}
                    type="button"
                    disabled={disabled}
                    onClick={() => tap(iso)}
                    className={`h-9 rounded-lg text-xs transition ${other ? "opacity-25" : ""} ${
                      isEdge
                        ? "bg-lime font-bold text-ink-950"
                        : inRange
                          ? "bg-lime/15 text-lime"
                          : disabled
                            ? "text-mist/30"
                            : "text-paper hover:bg-white/10"
                    }`}
                  >
                    {Number(iso.slice(8, 10))}
                  </button>
                );
              })}
            </div>

            <div className="mt-3 flex items-center justify-between gap-2 border-t border-white/8 pt-3">
              <div className="min-w-0">
                <p className="truncate text-xs text-paper">{label}</p>
                <p className="text-[10px] text-mist">
                  {count > 1 ? `${count} jours · 1 clic = date, 2 clics = plage` : "1 clic = date · 2e clic = plage"}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setDays([today]);
                    setMonth(monthOf(today));
                  }}
                  className="rounded-full border border-white/15 px-2.5 py-1.5 text-[11px] text-mist hover:text-paper"
                >
                  Aujourd&apos;hui
                </button>
                <button
                  type="button"
                  aria-label="Fermer"
                  onClick={() => setOpen(false)}
                  className="rounded-full bg-lime px-2.5 py-1.5 text-ink-950"
                >
                  <X size={12} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
