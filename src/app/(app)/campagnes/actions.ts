"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getUser } from "@/lib/supabase/server";
import { LIMITS } from "@/lib/campaigns/config";

const postEdit = z.object({
  id: z.string().uuid(),
  title: z.string().trim().min(1, "Le titre est vide.").max(LIMITS.titleMax, `Titre : ${LIMITS.titleMax} caractères maximum.`),
  caption: z.string().trim().min(1, "Le texte est vide.").max(LIMITS.captionMax),
  call_to_action: z.string().trim().max(200),
  hashtags: z
    .string()
    .transform((v) =>
      Array.from(
        new Set(
          v
            .split(/[\s,]+/)
            .map((t) => t.trim())
            .filter(Boolean)
            .map((t) => (t.startsWith("#") ? t : `#${t}`)),
        ),
      ).slice(0, LIMITS.hashtagsMax),
    ),
});

// RLS garantit que seul le propriétaire du commerce peut modifier ses contenus.
export async function updatePost(input: z.input<typeof postEdit>): Promise<{ error?: string }> {
  const parsed = postEdit.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { supabase, user } = await getUser();
  if (!user) return { error: "Session expirée." };
  const { id, ...fields } = parsed.data;
  const { data, error } = await supabase.from("posts").update(fields).eq("id", id).select("campaign_id").maybeSingle();
  if (error || !data) return { error: "Enregistrement impossible." };
  revalidatePath(`/campagnes/${data.campaign_id}`);
  return {};
}

export async function setPostStatus(id: string, status: "draft" | "ready"): Promise<{ error?: string }> {
  if (!z.string().uuid().safeParse(id).success) return { error: "Contenu introuvable." };
  const { supabase, user } = await getUser();
  if (!user) return { error: "Session expirée." };
  const { data, error } = await supabase.from("posts").update({ status }).eq("id", id).select("campaign_id").maybeSingle();
  if (error || !data) return { error: "Mise à jour impossible." };
  revalidatePath(`/campagnes/${data.campaign_id}`);
  return {};
}

export async function validateCampaign(campaignId: string): Promise<{ error?: string }> {
  if (!z.string().uuid().safeParse(campaignId).success) return { error: "Campagne introuvable." };
  const { supabase, user } = await getUser();
  if (!user) return { error: "Session expirée." };
  const { error: e1 } = await supabase.from("posts").update({ status: "ready" }).eq("campaign_id", campaignId);
  const { error: e2 } = await supabase.from("campaigns").update({ status: "validated" }).eq("id", campaignId);
  if (e1 || e2) return { error: "Validation impossible." };
  revalidatePath(`/campagnes/${campaignId}`);
  revalidatePath("/campagnes");
  return {};
}

export async function deleteCampaign(campaignId: string) {
  if (!z.string().uuid().safeParse(campaignId).success) return;
  const { supabase, user } = await getUser();
  if (!user) return;
  await supabase.from("campaigns").delete().eq("id", campaignId);
  revalidatePath("/", "layout");
  redirect("/campagnes");
}
