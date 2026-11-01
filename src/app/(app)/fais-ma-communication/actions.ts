"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentBusiness } from "@/lib/business";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { AIError, isAIConfigured } from "@/lib/ai/openai";
import { generateCampaign } from "@/lib/campaigns/generate";
import { CAMPAIGN_PLATFORMS, LIMITS, OBJECTIVES } from "@/lib/campaigns/config";

export type GenerateState = { error?: string } | undefined;

const schema = z.object({
  objective: z.enum(OBJECTIVES.map((o) => o.id) as [string, ...string[]], { message: "Choisissez un objectif." }),
  brief: z
    .string()
    .trim()
    .min(LIMITS.briefMin, "Décrivez votre besoin en une ou deux phrases.")
    .max(LIMITS.briefMax, `${LIMITS.briefMax} caractères maximum.`),
  facts: z
    .string()
    .trim()
    .max(LIMITS.factsMax, `${LIMITS.factsMax} caractères maximum.`)
    .transform((v) => (v === "" ? null : v)),
  platforms: z
    .array(z.enum(CAMPAIGN_PLATFORMS.map((p) => p.id) as [string, ...string[]]))
    .min(1, "Choisissez au moins une plateforme."),
  duration: z.coerce.number().refine((v) => v === 7 || v === 14, "Durée invalide."),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date de début invalide."),
  requestId: z.string().uuid(),
});

const AI_ERRORS: Record<AIError["kind"], string> = {
  config: "La connexion à l'IA n'est pas encore configurée. Aucun crédit n'a été utilisé.",
  timeout: "La génération a pris trop de temps. Réessayez : aucun crédit n'a été utilisé.",
  refusal: "L'IA n'a pas pu traiter cette demande. Reformulez-la : aucun crédit n'a été utilisé.",
  rate_limit: "Le service d'IA est très sollicité. Réessayez dans une minute : aucun crédit n'a été utilisé.",
  upstream: "Le service d'IA est momentanément indisponible. Réessayez : aucun crédit n'a été utilisé.",
  invalid: "La réponse de l'IA était incomplète. Réessayez : aucun crédit n'a été utilisé.",
};

export async function createCampaign(_: GenerateState, formData: FormData): Promise<GenerateState> {
  if (!isAIConfigured() || !isAdminConfigured())
    return { error: "La génération n'est pas encore activée : la configuration serveur est incomplète." };

  const parsed = schema.safeParse({
    objective: formData.get("objective"),
    brief: formData.get("brief") ?? "",
    facts: formData.get("facts") ?? "",
    platforms: formData.getAll("platforms"),
    duration: formData.get("duration"),
    startDate: formData.get("startDate"),
    requestId: formData.get("requestId"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const input = parsed.data;

  const today = new Date().toISOString().slice(0, 10);
  if (input.startDate < today) return { error: "La date de début ne peut pas être dans le passé." };

  const { supabase, user, business } = await getCurrentBusiness();
  if (!user) return { error: "Votre session a expiré. Reconnectez-vous." };
  if (!business) return { error: "Renseignez d'abord votre commerce dans « Mon commerce »." };

  // 1. Réserve un crédit (contrôle serveur atomique, protégé contre les doubles envois).
  const admin = createAdminClient();
  const key = `campaign:${input.requestId}`;
  const { data: quota, error: quotaError } = await admin.rpc("consume_generation", {
    p_user: user.id,
    p_business: business.id,
    p_action: "generate_campaign",
    p_key: key,
  });
  if (quotaError) {
    console.error("[createCampaign] quota", quotaError);
    return { error: "Vérification des crédits impossible. Réessayez." };
  }
  if (!quota?.ok) {
    if (quota?.reason === "quota")
      return { error: `Vous avez utilisé vos ${quota.quota} générations du mois avec l'offre ${quota.plan}. Elles se renouvellent le 1er du mois.` };
    if (quota?.reason === "duplicate") return { error: "Cette demande est déjà en cours de traitement." };
    return { error: "Commerce introuvable." };
  }

  // 2. Génère avec l'IA ; en cas d'échec, le crédit est rendu.
  let result: Awaited<ReturnType<typeof generateCampaign>>;
  try {
    result = await generateCampaign({
      business,
      objective: input.objective as never,
      brief: input.brief,
      facts: input.facts,
      platforms: input.platforms as never,
      durationDays: input.duration,
    });
  } catch (e) {
    await admin.rpc("refund_generation", { p_user: user.id, p_key: key });
    console.error("[createCampaign] génération", e);
    if (e instanceof AIError) return { error: AI_ERRORS[e.kind] };
    return { error: AI_ERRORS.invalid };
  }

  // 3. Enregistre la campagne et ses contenus (RLS : uniquement sur son propre commerce).
  const { campaign, model } = result;
  const { data: created, error: campaignError } = await supabase
    .from("campaigns")
    .insert({
      business_id: business.id,
      user_id: user.id,
      objective: input.objective,
      brief: input.brief,
      facts: input.facts,
      platforms: input.platforms,
      start_date: input.startDate,
      duration_days: input.duration,
      title: campaign.title,
      summary: campaign.summary,
      strategy: campaign.strategy,
      ai_model: model,
    })
    .select("id")
    .single();

  if (campaignError || !created) {
    await admin.rpc("refund_generation", { p_user: user.id, p_key: key });
    console.error("[createCampaign] enregistrement", campaignError);
    return { error: "La campagne n'a pas pu être enregistrée. Aucun crédit n'a été utilisé." };
  }

  const start = new Date(`${input.startDate}T12:00:00Z`);
  const rows = campaign.items.map((i) => {
    const d = new Date(start);
    d.setUTCDate(d.getUTCDate() + i.day - 1);
    return {
      business_id: business.id,
      campaign_id: created.id,
      platform: i.platform,
      format: i.format,
      youtube_format: i.platform === "youtube" ? "shorts" : null,
      scheduled_for: d.toISOString().slice(0, 10),
      title: i.title,
      caption: i.caption,
      short_caption: i.short_caption,
      call_to_action: i.call_to_action,
      hashtags: i.hashtags,
      visual_idea: i.visual_idea,
      status: "draft",
    };
  });

  const { error: postsError } = await supabase.from("posts").insert(rows);
  if (postsError) {
    await supabase.from("campaigns").delete().eq("id", created.id);
    await admin.rpc("refund_generation", { p_user: user.id, p_key: key });
    console.error("[createCampaign] contenus", postsError);
    return { error: "Les contenus n'ont pas pu être enregistrés. Aucun crédit n'a été utilisé." };
  }

  revalidatePath("/", "layout");
  redirect(`/campagnes/${created.id}`);
}
