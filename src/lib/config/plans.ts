// Offres affichées sur la page publique.
// - Libellés et avantages : src/i18n/messages (traduisibles).
// - Prix : table `plan_prices` (par marché et devise), lue par src/lib/pricing.ts.
// - Quotas : table `plan_limits`.
import { messages } from "@/i18n";

export type PlanId = "free" | "starter" | "pro" | "business";

export type Plan = { id: PlanId; name: string; highlight?: boolean; features: string[] };

export const PLAN_IDS: PlanId[] = ["free", "starter", "pro", "business"];

export const PLANS: Plan[] = PLAN_IDS.map((id) => ({
  id,
  name: messages.plans[id].name,
  features: messages.plans[id].features,
  highlight: id === "pro",
}));
