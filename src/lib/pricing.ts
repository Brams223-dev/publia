import "server-only";
import { createClient } from "@supabase/supabase-js";
import { getMarket } from "@/config/markets";
import { FALLBACK_PRICES } from "@/config/pricing";
import { PLAN_IDS, type PlanId } from "@/lib/config/plans";
import { SUPABASE_PUBLIC_KEY, SUPABASE_URL, isSupabaseConfigured } from "@/lib/supabase/env";

export type PlanPrice = { plan: PlanId; amountCents: number; currency: string; taxInclusive: boolean };

/** Prix mensuels d'un marché, depuis `plan_prices` (lecture publique), avec repli sur la config. */
export async function getPlanPrices(marketCode?: string): Promise<{ market: ReturnType<typeof getMarket>; prices: PlanPrice[] }> {
  const market = getMarket(marketCode);
  const fallback = PLAN_IDS.map((plan) => ({
    plan,
    amountCents: FALLBACK_PRICES[market.code][plan],
    currency: market.currency,
    taxInclusive: market.tax.pricesIncludeTax,
  }));
  if (!isSupabaseConfigured()) return { market, prices: fallback };

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLIC_KEY, { auth: { persistSession: false } });
    const { data, error } = await supabase
      .from("plan_prices")
      .select("plan, amount_cents, currency, tax_inclusive")
      .eq("market_code", market.code)
      .eq("interval", "month");
    if (error || !data?.length) return { market, prices: fallback };
    const prices = PLAN_IDS.map((plan) => {
      const row = data.find((r) => r.plan === plan);
      return row
        ? { plan, amountCents: row.amount_cents, currency: row.currency, taxInclusive: row.tax_inclusive }
        : fallback.find((f) => f.plan === plan)!;
    });
    return { market, prices };
  } catch {
    return { market, prices: fallback };
  }
}
