import { JourneeDesk } from "@/components/journee-desk";
import { loadDay } from "@/lib/xbet/day-store";

export const dynamic = "force-dynamic";

export const metadata = { title: "Journée" };

export default async function JourneePage() {
  const day = new Date().toISOString().slice(0, 10);
  const line = await loadDay(day);
  return <JourneeDesk initialDay={day} initialLine={line} />;
}
