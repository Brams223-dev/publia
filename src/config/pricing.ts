// Prix de secours par marché, utilisés uniquement si la base est momentanément injoignable.
// La source de vérité est la table Supabase `plan_prices` : toute modification de prix s'y fait.
import type { CountryCode } from "./markets";
import type { PlanId } from "@/lib/config/plans";

export const FALLBACK_PRICES: Record<CountryCode, Record<PlanId, number>> = {
  FR: { free: 0, starter: 1990, pro: 3990, business: 5990 },
};
