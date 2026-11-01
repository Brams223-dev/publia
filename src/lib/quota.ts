import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

export type Quota = {
  plan: string;
  planName: string;
  generationsUsed: number;
  generationsQuota: number;
  videoUsed: number;
  videoQuota: number;
};

/**
 * Quota de l'organisation du commerce (partagé par toute l'équipe).
 * Affichage uniquement : l'autorisation réelle est faite par consume_generation() côté serveur.
 */
export async function getQuota(supabase: SupabaseClient, businessId: string | null | undefined): Promise<Quota> {
  const [{ data: q }, { data: limits }] = await Promise.all([
    businessId ? supabase.rpc("org_quota", { p_business: businessId }) : Promise.resolve({ data: null }),
    supabase.from("plan_limits").select("plan, name, monthly_generations, monthly_video_credits"),
  ]);
  const r = q as { plan: string; quota: number; used: number; video_quota: number } | null;
  const plan = r?.plan ?? "free";
  const limit = limits?.find((l) => l.plan === plan) ?? limits?.find((l) => l.plan === "free");
  return {
    plan,
    planName: limit?.name ?? "Free",
    generationsUsed: Number(r?.used ?? 0),
    generationsQuota: r?.quota ?? limit?.monthly_generations ?? 0,
    videoUsed: 0,
    videoQuota: r?.video_quota ?? limit?.monthly_video_credits ?? 0,
  };
}
