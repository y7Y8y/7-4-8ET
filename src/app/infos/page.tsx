export const metadata = { title: "Infos" };

export default function InfosPage() {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-[11px] uppercase tracking-[0.28em] text-lime">Règles</p>
        <h1 className="mt-1 font-display text-3xl font-semibold">1,01 · 50 · 5</h1>
      </div>
      <ul className="space-y-3 text-sm text-mist">
        <li className="rounded-2xl border border-white/8 bg-ink-800/40 p-4">
          <p className="text-paper">Cotes 1xBet réelles</p>
          <p className="mt-1">Football et autres sports pré-match. Hosts : 1xbet.ci, puis 1xbet.com, puis linebet (même moteur).</p>
        </li>
        <li className="rounded-2xl border border-white/8 bg-ink-800/40 p-4">
          <p className="text-paper">Bande 1,007 – 1,01</p>
          <p className="mt-1">Une seule cote par match, la plus proche de 1,01. Plafond 1xBet : 50 sélections.</p>
        </li>
        <li className="rounded-2xl border border-white/8 bg-ink-800/40 p-4">
          <p className="text-paper">5 paniers / jour</p>
          <p className="mt-1">Produit visé ≈ 1,64 (50 × 1,01). Tu recopies à la main. Mise mini = code, pas un placement auto.</p>
        </li>
        <li className="rounded-2xl border border-white/8 bg-ink-800/40 p-4">
          <p className="text-paper">Purge</p>
          <p className="mt-1">Si un match du panier a commencé, le panier disparaît. Ajoute l&apos;écran d&apos;accueil pour l&apos;ouvrir comme une app.</p>
        </li>
      </ul>
      <p className="text-xs text-mist">18+ · Jeu responsable · Aucun compte 1xBet n&apos;est ouvert par NINETY.</p>
    </div>
  );
}
