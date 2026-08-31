import Link from "next/link";

export default function NotFound() {
  return (
    <div className="py-20 text-center">
      <p className="font-score text-7xl text-lime">90</p>
      <h1 className="mt-4 font-display text-3xl">Hors-jeu.</h1>
      <p className="mt-2 text-mist">Cette page n&apos;existe pas.</p>
      <Link href="/" className="mt-6 inline-block rounded-full bg-lime px-5 py-2 text-sm font-semibold text-ink-950">
        Retour au cockpit
      </Link>
    </div>
  );
}
