import { CombineDesk } from "@/components/combine-desk";
import { PageHead } from "@/components/shell";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Combiné 1,01" };

export default function CombinePage() {
  return (
    <div>
      <PageHead
        kicker="Proprio · 1xBet · pré-match"
        title="1,01 → 10."
        sub="Scanner les cotes 1xBet entre 1,007 et 1,01. Empiler un combiné jusqu'à 10, 5 en secours. Une jambe par match. Pas de live. Pas de robot de mise — coupon à coller, mise mini pour le code."
      />
      <CombineDesk />
    </div>
  );
}
