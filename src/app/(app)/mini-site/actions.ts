"use server";

import { revalidatePath } from "next/cache";
import { canManage, getCurrentBusiness } from "@/lib/business";
import { checkRateLimit } from "@/lib/rate-limit";
import { siteSettingsSchema, validateSlug } from "@/lib/minisite";
import { reportError } from "@/lib/observability";

export type FormState = { error?: string; success?: string } | undefined;

export async function saveMiniSite(_: FormState, formData: FormData): Promise<FormState> {
  const { supabase, user, business, role } = await getCurrentBusiness();
  if (!user || !business) return { error: "Session expirée." };
  if (!canManage(role)) return { error: "Seuls le propriétaire et les administrateurs peuvent modifier le mini-site." };
  const limited = await checkRateLimit(supabase, "write");
  if (limited) return { error: limited };

  const slug = String(formData.get("slug") ?? "").trim().toLowerCase();
  const slugError = validateSlug(slug);
  if (slugError) return { error: slugError };
  const flag = (k: string) => formData.get(k) === "on";
  const parsed = siteSettingsSchema.safeParse({
    headline: String(formData.get("headline") ?? ""),
    about: String(formData.get("about") ?? ""),
    show_catalogue: flag("show_catalogue"),
    show_reviews: flag("show_reviews"),
    show_contact_form: flag("show_contact_form"),
    show_hours: flag("show_hours"),
    show_phone: flag("show_phone"),
    show_address: flag("show_address"),
    google_review_url: String(formData.get("google_review_url") ?? ""),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const published = flag("published");
  if (published && !business.description && !parsed.data.about) return { error: "Ajoutez une présentation (ou une description dans « Mon commerce ») avant de publier." };

  const { data: current } = await supabase.from("shops").select("settings").eq("business_id", business.id).maybeSingle();
  const settings = { ...((current?.settings as Record<string, unknown>) ?? {}), ...parsed.data };
  const { error } = await supabase
    .from("shops")
    .upsert({ business_id: business.id, slug, published, settings, name: String(formData.get("name") ?? "").trim().slice(0, 80) || null }, { onConflict: "business_id" });
  if (error) {
    if (error.code === "23505") return { error: "Cette adresse est déjà prise par un autre commerce. Choisissez-en une autre." };
    await reportError("action", "saveMiniSite", error, { userId: user.id });
    return { error: "Enregistrement impossible." };
  }
  revalidatePath("/mini-site");
  revalidatePath(`/b/${slug}`);
  return { success: published ? "Mini-site enregistré et en ligne." : "Mini-site enregistré (non publié)." };
}
