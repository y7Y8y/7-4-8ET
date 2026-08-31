"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Clapperboard,
  Gauge,
  Radio,
  Sparkles,
  Ticket,
  Trophy,
} from "lucide-react";

const NAV = [
  { href: "/", label: "Accueil", icon: Gauge },
  { href: "/live", label: "Live", icon: Radio },
  { href: "/matchs", label: "Matchs", icon: Ticket },
  { href: "/cotes", label: "Cotes", icon: Sparkles },
  { href: "/pronostics", label: "Pronostics", icon: Gauge },
  { href: "/championnats", label: "Championnats", icon: Trophy },
  { href: "/highlights", label: "Highlights", icon: Clapperboard },
];

export function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  return (
    <div className="min-h-screen">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[220px] flex-col border-r border-white/8 bg-ink-950/90 px-4 py-6 backdrop-blur md:flex">
        <Link href="/" className="px-2">
          <Logo />
        </Link>
        <nav className="mt-10 flex flex-1 flex-col gap-1">
          {NAV.map((item) => {
            const active = item.href === "/" ? path === "/" : path.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${
                  active ? "bg-lime text-ink-950" : "text-mist hover:bg-white/5 hover:text-paper"
                }`}
              >
                <Icon size={16} />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <p className="px-3 text-[10px] uppercase tracking-[0.22em] text-mist/70">
          Live · Cotes · Modèle
        </p>
      </aside>

      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-white/8 bg-ink-950/80 px-4 py-3 backdrop-blur md:hidden">
        <Link href="/">
          <Logo compact />
        </Link>
        <span className="text-[10px] uppercase tracking-[0.2em] text-mist">Cockpit</span>
      </header>

      <main className="md:pl-[220px]">
        <div className="mx-auto min-h-screen max-w-6xl px-4 pb-24 pt-6 md:px-8 md:pb-12 md:pt-8">
          {children}
        </div>
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-white/8 bg-ink-950/95 px-1 py-2 backdrop-blur md:hidden">
        {NAV.slice(0, 5).map((item) => {
          const active = item.href === "/" ? path === "/" : path.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center gap-1 rounded-lg py-1 text-[10px] ${
                active ? "text-lime" : "text-mist"
              }`}
            >
              <Icon size={16} />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <span className="inline-flex items-baseline gap-1 font-display tracking-tight">
      <span className="text-2xl font-bold text-lime">90</span>
      {!compact && <span className="text-lg font-semibold text-paper">NINETY</span>}
    </span>
  );
}

export function PageHead({
  kicker,
  title,
  sub,
}: {
  kicker: string;
  title: string;
  sub?: string;
}) {
  return (
    <header className="mb-8">
      <p className="text-[11px] uppercase tracking-[0.28em] text-lime">{kicker}</p>
      <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight md:text-5xl">{title}</h1>
      {sub && <p className="mt-3 max-w-2xl text-sm text-mist">{sub}</p>}
    </header>
  );
}
