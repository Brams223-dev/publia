"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentBusiness } from "@/lib/business";
import { checkRateLimit } from "@/lib/rate-limit";

type Result = { error?: string; ok?: boolean };

/** Modération : publier, masquer (motif légitime uniquement) ou remettre en attente. La note et le texte ne sont jamais modifiés. */
export async function moderateReview(id: string, status: "published" | "hidden" | "pending"): Promise<Result> {
  if (!["published", "hidden", "pending"].includes(status)) return { error: "Statut invalide." };
  const { supabase, business } = await getCurrentBusiness();
  if (!business) return { error: "Session expirée." };
  const limited = await checkRateLimit(supabase, "write");
  if (limited) return { error: limited };
  const { data, error } = await supabase.from("reviews").update({ status }).eq("id", id).eq("business_id", business.id).select("id");
  if (error || !data?.length) return { error: "Mise à jour impossible." };
  revalidatePath("/avis");
  return { ok: true };
}

const replySchema = z.string().trim().max(1000, "1 000 caractères maximum.");

export async function replyToReview(id: string, reply: string): Promise<Result> {
  const parsed = replySchema.safeParse(reply);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { supabase, business } = await getCurrentBusiness();
  if (!business) return { error: "Session expirée." };
  const limited = await checkRateLimit(supabase, "write");
  if (limited) return { error: limited };
  const { data, error } = await supabase
    .from("reviews")
    .update({ reply: parsed.data || null, replied_at: parsed.data ? new Date().toISOString() : null })
    .eq("id", id)
    .eq("business_id", business.id)
    .select("id");
  if (error || !data?.length) return { error: "Enregistrement impossible." };
  revalidatePath("/avis");
  return { ok: true };
}
