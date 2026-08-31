"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Layers, Radar, Info } from "lucide-react";

const NAV = [
  { href: "/", label: "Paniers", icon: Layers },
  { href: "/scan", label: "Scanner", icon: Radar },
  { href: "/infos", label: "Infos", icon: Info },
];

export function PhoneShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  return (
    <div className="mx-auto min-h-[100dvh] max-w-lg">
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-white/8 bg-ink-950/90 px-4 py-3 backdrop-blur pt-[max(0.75rem,env(safe-area-inset-top))]">
        <Link href="/" className="inline-flex items-baseline gap-1.5">
          <span className="font-display text-2xl font-bold text-lime">90</span>
          <span className="font-display text-lg font-semibold">NINETY</span>
        </Link>
        <span className="rounded-full border border-lime/30 bg-lime/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-lime">
          1,01
        </span>
      </header>
      <main className="px-4 pb-28 pt-4">{children}</main>
      <nav className="fixed inset-x-0 bottom-0 z-30 mx-auto grid max-w-lg grid-cols-3 border-t border-white/8 bg-ink-950/95 px-2 pt-2 backdrop-blur pb-[max(0.5rem,env(safe-area-inset-bottom))]">
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
