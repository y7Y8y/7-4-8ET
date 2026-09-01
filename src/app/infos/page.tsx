"use client";

import { useEffect, useState } from "react";

export default function InfosPage() {
  const [link, setLink] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setLink(window.location.origin);
  }, []);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[11px] uppercase tracking-[0.28em] text-lime">Mode d&apos;emploi</p>
        <h1 className="mt-1 font-display text-3xl font-semibold">Comment ça marche</h1>
      </div>

      <ol className="space-y-3 text-sm text-mist">
        <li className="rounded-2xl border border-white/8 bg-ink-800/40 p-4">
          <p className="text-paper">1. Tu es déjà sur l&apos;app</p>
          <p className="mt-1">Pas d&apos;URL à chercher. Cet écran = NINETY. Sur ton vrai téléphone : copie le lien ci-dessous, ouvre-le dans Chrome, puis « Ajouter à l&apos;écran d&apos;accueil ».</p>
          {link && (
            <button
              type="button"
              onClick={() => void copyLink()}
              className="mt-3 w-full rounded-full bg-lime py-2.5 text-sm font-semibold text-ink-950"
            >
              {copied ? "Lien copié" : "Copier le lien de l'app"}
            </button>
          )}
          {link && <p className="mt-2 break-all text-[11px] text-mist/80">{link}</p>}
        </li>
        <li className="rounded-2xl border border-white/8 bg-ink-800/40 p-4">
          <p className="text-paper">2. Scanner (sur l&apos;accueil)</p>
          <p className="mt-1">
            Le bouton vert <span className="text-paper">Scanner 1xBet</span> est directement sur l&apos;accueil, en
            haut. Le scan lit <span className="text-paper">tous les marchés</span> de chaque match{" "}
            <span className="text-paper">pas encore commencé</span> (jamais en live), et en sort les cotes de la
            bande choisie — la plus proche de 1,01 par match.
          </p>
          <p className="mt-2">
            <span className="text-paper">Choisir le ou les jours</span> : l&apos;icône de calendrier en haut à droite
            — un clic sur une date, ou deux clics (départ puis arrivée) pour une plage. Les réglages et les règles du
            scan sont derrière le <span className="text-paper">☰ en haut à gauche</span>.
          </p>
        </li>
        <li className="rounded-2xl border border-white/8 bg-ink-800/40 p-4">
          <p className="text-paper">3. Matchs commencés</p>
          <p className="mt-1">
            Un match commence → son panier saute tout seul à l&apos;ouverture de l&apos;app. Le bouton{" "}
            <span className="text-paper">Actualiser</span> nettoie et recharge à la demande : que des matchs pas
            encore commencés, toujours.
          </p>
        </li>
        <li className="rounded-2xl border border-white/8 bg-ink-800/40 p-4">
          <p className="text-paper">4. Recopier sur 1xBet</p>
          <p className="mt-1">Ouvre un panier : tu vois équipe vs équipe, le pari (Plus de 0,5 buts, Handicap +1…), la cote. Copier → colle dans 1xBet. Pas de login ici, pas de mise auto.</p>
        </li>
        <li className="rounded-2xl border border-white/8 bg-ink-800/40 p-4">
          <p className="text-paper">Les marchés</p>
          <p className="mt-1">Uniquement ce que tu retrouves sur 1xBet : 1 / Nul / 2, handicap (+1), plus/moins de buts. Plus de code du style « marché 206 ».</p>
        </li>
        <li className="rounded-2xl border border-white/8 bg-ink-800/40 p-4">
          <p className="text-paper">Chaque panier ≥ 1,50 · 50 × 1,01 ≈ 1,64</p>
          <p className="mt-1">
            Un panier ne sert à rien s&apos;il n&apos;atteint pas la cote totale visée (1,50 par défaut, réglable
            dans le ☰) : s&apos;il n&apos;y a pas assez de matchs, un seul panier regroupe tout au lieu d&apos;en
            empiler plusieurs à 1,05. Et si un match a commencé, le panier saute tout seul.
          </p>
        </li>
      </ol>
      <p className="text-xs text-mist">
        Code :{" "}
        <a className="text-lime underline" href="https://github.com/y7Y8y/7-4-8ET" target="_blank" rel="noreferrer">
          github.com/y7Y8y/7-4-8ET
        </a>
        . 18+ · Jeu responsable.
      </p>
    </div>
  );
}
