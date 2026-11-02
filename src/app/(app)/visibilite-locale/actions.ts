"use server";

import { revalidatePath } from "next/cache";
import { canManage, getCurrentBusiness } from "@/lib/business";
import { GOOGLE_CHECKLIST } from "@/lib/local-visibility";

type Result = { error?: string; ok?: boolean };

/** Enregistre une vérification de la fiche Google déclarée par le commerçant. */
export async function setDeclaredCheck(id: string, done: boolean): Promise<Result> {
  if (!GOOGLE_CHECKLIST.some((g) => g.id === id)) return { error: "Vérification inconnue." };
  const { supabase, business, role } = await getCurrentBusiness();
  if (!business) return { error: "Session expirée." };
  if (!canManage(role)) return { error: "Seuls le propriétaire et les administrateurs peuvent modifier cette liste." };
  const { data: shop } = await supabase.from("shops").select("settings").eq("business_id", business.id).maybeSingle();
  const settings = (shop?.settings as Record<string, unknown>) ?? {};
  const declared = { ...((settings.visibility_checklist as Record<string, boolean>) ?? {}), [id]: done };
  const { error } = await supabase.from("shops").upsert({ business_id: business.id, settings: { ...settings, visibility_checklist: declared } }, { onConflict: "business_id" });
  if (error) return { error: "Enregistrement impossible." };
  revalidatePath("/visibilite-locale");
  return { ok: true };
}
