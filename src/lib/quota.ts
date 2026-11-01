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

/** Affichage uniquement : l'autorisation réelle est faite par consume_generation() côté serveur. */
export async function getQuota(supabase: SupabaseClient, userId: string): Promise<Quota> {
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);

  const [sub, usage, video, limits] = await Promise.all([
    supabase.from("subscriptions").select("plan, status").eq("user_id", userId).maybeSingle(),
    supabase
      .from("usage_logs")
      .select("credits_used")
      .eq("user_id", userId)
      .in("action", ["generate_post", "generate_youtube", "generate_campaign"])
      .gte("created_at", monthStart.toISOString()),
    supabase.from("video_usage").select("credits_used").eq("user_id", userId).gte("created_at", monthStart.toISOString()),
    supabase.from("plan_limits").select("plan, name, monthly_generations, monthly_video_credits"),
  ]);

  const active = sub.data && ["active", "trialing"].includes(sub.data.status);
  const plan = active ? sub.data!.plan : "free";
  const limit = limits.data?.find((l) => l.plan === plan) ?? limits.data?.find((l) => l.plan === "free");
  const sum = (rows: { credits_used: number }[] | null) => (rows ?? []).reduce((a, r) => a + r.credits_used, 0);

  return {
    plan,
    planName: limit?.name ?? "Free",
    generationsUsed: sum(usage.data),
    generationsQuota: limit?.monthly_generations ?? 0,
    videoUsed: sum(video.data),
    videoQuota: limit?.monthly_video_credits ?? 0,
  };
}
