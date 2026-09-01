"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { loadDays, loadParams, saveDays, saveParams } from "@/lib/xbet/local";
import { normalizeDays } from "@/lib/xbet/days";
import { SCAN_DEFAULTS, type ScanParams } from "@/lib/xbet/types";

type ScanConfig = {
  params: ScanParams;
  patchParams: (p: Partial<ScanParams>) => void;
  resetParams: () => void;
  /** Jours choisis au calendrier — vide tant que le localStorage n'est pas lu. */
  days: string[];
  setDays: (days: string[]) => void;
};

const Ctx = createContext<ScanConfig | null>(null);

export function ScanConfigProvider({ children }: { children: React.ReactNode }) {
  const [params, setParams] = useState<ScanParams>(SCAN_DEFAULTS);
  const [days, setDaysState] = useState<string[]>([]);

  useEffect(() => {
    setParams(loadParams());
    const saved = loadDays();
    setDaysState(saved.length ? saved : normalizeDays([]));
  }, []);

  const patchParams = useCallback((p: Partial<ScanParams>) => {
    setParams((prev) => {
      const next = { ...prev, ...p };
      saveParams(next);
      return next;
    });
  }, []);

  const resetParams = useCallback(() => {
    setParams(SCAN_DEFAULTS);
    saveParams(SCAN_DEFAULTS);
  }, []);

  const setDays = useCallback((next: string[]) => {
    const clean = normalizeDays(next);
    setDaysState(clean);
    saveDays(clean);
  }, []);

  const value = useMemo(
    () => ({ params, patchParams, resetParams, days, setDays }),
    [params, patchParams, resetParams, days, setDays],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useScanConfig(): ScanConfig {
  const v = useContext(Ctx);
  if (!v) throw new Error("useScanConfig hors ScanConfigProvider");
  return v;
}
