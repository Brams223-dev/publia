"use server";

import { revalidatePath } from "next/cache";
import { getCurrentBusiness } from "@/lib/business";

type Result = { error?: string; ok?: boolean };

export async function setMessageStatus(id: string, status: "new" | "read" | "archived"): Promise<Result> {
  if (!["new", "read", "archived"].includes(status)) return { error: "Statut invalide." };
  const { supabase, business } = await getCurrentBusiness();
  if (!business) return { error: "Session expirée." };
  const { error } = await supabase.from("inbox_messages").update({ status }).eq("id", id).eq("business_id", business.id);
  if (error) return { error: "Mise à jour impossible." };
  revalidatePath("/inbox");
  return { ok: true };
}

export async function deleteMessage(id: string): Promise<Result> {
  const { supabase, business } = await getCurrentBusiness();
  if (!business) return { error: "Session expirée." };
  const { error } = await supabase.from("inbox_messages").delete().eq("id", id).eq("business_id", business.id);
  if (error) return { error: "Suppression impossible." };
  revalidatePath("/inbox");
  return { ok: true };
}
