"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Layers, Info } from "lucide-react";
import { ScanDrawer } from "./scan-drawer";
import { DayPicker } from "./day-picker";

const NAV = [
  { href: "/", label: "Paniers", icon: Layers },
  { href: "/infos", label: "Infos", icon: Info },
];

export function PhoneShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  return (
    <div className="mx-auto min-h-[100dvh] max-w-lg">
      <header className="sticky top-0 z-20 border-b border-white/8 bg-ink-950/90 px-3 py-2.5 backdrop-blur pt-[max(0.625rem,env(safe-area-inset-top))]">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-1.5">
            <ScanDrawer />
            <Link href="/" className="inline-flex items-baseline gap-1.5">
              <span className="font-display text-2xl font-bold text-lime">90</span>
              <span className="font-display text-lg font-semibold">NINETY</span>
            </Link>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span className="rounded-full border border-lime/30 bg-lime/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-lime">
              1,01
            </span>
            <DayPicker />
          </div>
        </div>
      </header>
      <main className="px-4 pb-28 pt-4">{children}</main>
      <nav className="fixed inset-x-0 bottom-0 z-30 mx-auto grid max-w-lg grid-cols-2 border-t border-white/8 bg-ink-950/95 px-2 pt-2 backdrop-blur pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        {NAV.map((item) => {
          const active = item.href === "/" ? path === "/" : path.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center gap-1 rounded-xl py-2 text-[11px] ${
                active ? "text-lime" : "text-mist"
              }`}
            >
              <Icon size={18} />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
