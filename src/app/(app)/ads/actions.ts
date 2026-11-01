"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentBusiness } from "@/lib/business";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { AIError, isAIConfigured } from "@/lib/ai";
import { generateAdCreatives } from "@/lib/ads/generate";
import { AD_OBJECTIVES, AD_PLATFORMS, platformById, type AdObjective, type AdPlatform } from "@/lib/ads/config";
import { checkBudget } from "@/lib/ads/budget";
import { localDay } from "@/lib/autopilot/time";

export type AdFormState = { error?: string } | undefined;

const createSchema = z.object({
  platform: z.enum(AD_PLATFORMS.map((p) => p.id) as [AdPlatform, ...AdPlatform[]]),
  objective: z.enum(Object.keys(AD_OBJECTIVES) as [AdObjective, ...AdObjective[]]),
  offer: z.string().trim().min(10, "Décrivez ce que vous voulez promouvoir.").max(800),
  facts: z.string().trim().max(800).transform((v) => (v === "" ? null : v)),
  creationId: z.string().transform((v) => (v === "" ? null : v)).pipe(z.string().uuid().nullable()),
  landingUrl: z
    .string()
    .trim()
    .max(300)
    .transform((v, ctx) => {
      if (!v) return null;
      try {
        const u = new URL(/^https?:\/\//i.test(v) ? v : `https://${v}`);
        return u.toString();
      } catch {
        ctx.addIssue({ code: "custom", message: "Adresse du site invalide." });
        return z.NEVER;
      }
    }),
  city: z.string().trim().max(100),
  daily: z.coerce.number().positive("Indiquez un budget quotidien."),
  cap: z.coerce.number().positive("Indiquez un plafond de dépense."),
  start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  requestId: z.string().uuid(),
});

const AI_ERRORS: Record<AIError["kind"], string> = {
  config: "La connexion à l'IA n'est pas encore configurée. Aucun crédit n'a été utilisé.",
  timeout: "La génération a pris trop de temps. Réessayez : aucun crédit n'a été utilisé.",
  refusal: "L'IA n'a pas pu traiter cette demande. Reformulez-la : aucun crédit n'a été utilisé.",
  rate_limit: "Le service d'IA est très sollicité. Réessayez dans une minute : aucun crédit n'a été utilisé.",
  upstream: "Le service d'IA est momentanément indisponible : aucun crédit n'a été utilisé.",
  invalid: "La réponse de l'IA était incomplète. Réessayez : aucun crédit n'a été utilisé.",
};

export async function createAdCampaign(_: AdFormState, formData: FormData): Promise<AdFormState> {
  if (!isAIConfigured() || !isAdminConfigured()) return { error: "La génération n'est pas encore activée : configuration serveur incomplète." };
  const parsed = createSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;

  const cfg = platformById(d.platform);
  if (!cfg.objectives.includes(d.objective)) return { error: `L'objectif choisi n'est pas proposé par ${cfg.name}.` };

  const dailyCents = Math.round(d.daily * 100);
  const capCents = Math.round(d.cap * 100);
  const budget = checkBudget({ dailyCents, capCents, start: d.start, end: d.end, today: localDay(new Date()).iso });
  if (!budget.ok) return { error: budget.error };

  const { supabase, user, business } = await getCurrentBusiness();
  if (!user) return { error: "Session expirée." };
  if (!business) return { error: "Renseignez d'abord votre commerce." };

  if (d.creationId) {
    const { data: c } = await supabase.from("creations").select("id").eq("id", d.creationId).maybeSingle();
    if (!c) return { error: "Visuel introuvable." };
  }

  const admin = createAdminClient();
  const key = `ads:${d.requestId}`;
  const { data: quota, error: qErr } = await admin.rpc("consume_generation", {
    p_user: user.id,
    p_business: business.id,
    p_action: "generate_ads",
    p_key: key,
  });
  if (qErr) return { error: "Vérification des crédits impossible. Réessayez." };
  if (!quota?.ok) {
    if (quota?.reason === "quota") return { error: `Vous avez utilisé vos ${quota.quota} générations du mois (offre ${quota.plan}).` };
    if (quota?.reason === "duplicate") return { error: "Cette demande est déjà en cours." };
    return { error: "Commerce introuvable." };
  }

  let gen: Awaited<ReturnType<typeof generateAdCreatives>>;
  try {
    gen = await generateAdCreatives({ business, platform: d.platform, objective: d.objective, offer: d.offer, facts: d.facts });
  } catch (e) {
    await admin.rpc("refund_generation", { p_user: user.id, p_key: key });
    console.error("[createAdCampaign]", e);
    return { error: e instanceof AIError ? AI_ERRORS[e.kind] : AI_ERRORS.invalid };
  }

  const { data: campaign, error } = await supabase
    .from("ad_campaigns")
    .insert({
      business_id: business.id,
      user_id: user.id,
      platform: d.platform,
      objective: d.objective,
      name: gen.name,
      offer: d.offer,
      facts: d.facts,
      creation_id: d.creationId,
      landing_url: d.landingUrl ?? business.website,
      geo: { city: d.city || business.city || "", radius_km: gen.audience.radius_km },
      audience: { age_min: gen.audience.age_min, age_max: gen.audience.age_max, interests: gen.audience.interests, rationale: gen.audience.rationale },
      daily_budget_cents: dailyCents,
      spend_cap_cents: capCents,
      start_date: d.start,
      end_date: d.end,
      ai_model: gen.model,
    })
    .select("id")
    .single();

  if (error || !campaign) {
    await admin.rpc("refund_generation", { p_user: user.id, p_key: key });
    console.error("[createAdCampaign] insert", error);
    return { error: "La campagne n'a pas pu être enregistrée. Aucun crédit n'a été utilisé." };
  }

  await supabase.from("ad_variants").insert(
    gen.variants.map((v, i) => ({ ...v, ad_campaign_id: campaign.id, business_id: business.id, sort_order: i, selected: i < 2 })),
  );
  await supabase.from("ad_events").insert([
    { ad_campaign_id: campaign.id, business_id: business.id, event: "created" },
    { ad_campaign_id: campaign.id, business_id: business.id, event: "variants_generated", detail: `${gen.variants.length} variantes` },
  ]);

  revalidatePath("/ads");
  redirect(`/ads/${campaign.id}`);
}

// ---------------------------------------------------------------------------
// Édition du brouillon (aucun impact sur des dépenses réelles : rien n'est diffusé)
// ---------------------------------------------------------------------------
const variantSchema = z.object({
  id: z.string().uuid(),
  headline: z.string().trim().min(1).max(120),
  primary_text: z.string().trim().min(1).max(1000),
  description: z.string().trim().max(200),
  cta: z.string().trim().min(1).max(40),
});

export async function updateVariant(input: z.input<typeof variantSchema>): Promise<{ error?: string }> {
  const p = variantSchema.safeParse(input);
  if (!p.success) return { error: "Champs invalides." };
  const { supabase, user } = await getCurrentBusiness();
  if (!user) return { error: "Session expirée." };
  const { id, ...fields } = p.data;
  const { data, error } = await supabase.from("ad_variants").update(fields).eq("id", id).select("ad_campaign_id").maybeSingle();
  if (error || !data) return { error: "Enregistrement impossible." };
  revalidatePath(`/ads/${data.ad_campaign_id}`);
  return {};
}

export async function toggleVariant(id: string, selected: boolean): Promise<{ error?: string }> {
  if (!z.string().uuid().safeParse(id).success) return { error: "Variante introuvable." };
  const { supabase, user } = await getCurrentBusiness();
  if (!user) return { error: "Session expirée." };
  const { data } = await supabase.from("ad_variants").update({ selected }).eq("id", id).select("ad_campaign_id").maybeSingle();
  if (data) revalidatePath(`/ads/${data.ad_campaign_id}`);
  return {};
}

export async function setAdStatus(id: string, status: "draft" | "ready" | "archived"): Promise<{ error?: string }> {
  if (!z.string().uuid().safeParse(id).success) return { error: "Campagne introuvable." };
  const { supabase, user, business } = await getCurrentBusiness();
  if (!user || !business) return { error: "Session expirée." };
  if (status === "ready") {
    const { count } = await supabase.from("ad_variants").select("id", { count: "exact", head: true }).eq("ad_campaign_id", id).eq("selected", true);
    if (!count) return { error: "Sélectionnez au moins une variante." };
  }
  const { error } = await supabase.from("ad_campaigns").update({ status }).eq("id", id).in("status", ["draft", "ready", "archived"]);
  if (error) return { error: "Mise à jour impossible." };
  await supabase.from("ad_events").insert({
    ad_campaign_id: id,
    business_id: business.id,
    event: status === "ready" ? "validated" : status === "archived" ? "archived" : "edited",
  });
  revalidatePath(`/ads/${id}`);
  revalidatePath("/ads");
  return {};
}

export async function deleteAdCampaign(id: string) {
  if (!z.string().uuid().safeParse(id).success) return;
  const { supabase, user } = await getCurrentBusiness();
  if (!user) return;
  await supabase.from("ad_campaigns").delete().eq("id", id).in("status", ["draft", "ready", "archived"]);
  revalidatePath("/ads");
  redirect("/ads");
}
