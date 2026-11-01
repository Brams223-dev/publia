"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentBusiness } from "@/lib/business";
import { assignSlots, computeSlots, ruleSchema } from "@/lib/autopilot/scheduler";
import { DEFAULT_TZ, zonedToUtc } from "@/lib/autopilot/time";

type Result = { error?: string; success?: string };

function refresh() {
  revalidatePath("/autopilot");
  revalidatePath("/calendrier");
  revalidatePath("/campagnes", "layout");
}

// ---------------------------------------------------------------------------
// Réglages hebdomadaires
// ---------------------------------------------------------------------------
const settingsSchema = z.object({
  enabled: z.boolean(),
  weeksAhead: z.number().int().min(1).max(8),
  rules: z.array(ruleSchema).max(8),
});

export async function saveAutopilot(input: z.input<typeof settingsSchema>): Promise<Result> {
  const parsed = settingsSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { supabase, user, business } = await getCurrentBusiness();
  if (!user || !business) return { error: "Renseignez d'abord votre commerce." };

  const rules = parsed.data.rules.filter((r) => r.days.length > 0);
  if (parsed.data.enabled && rules.length === 0) return { error: "Choisissez au moins un jour de publication." };

  const { error } = await supabase.from("autopilot_settings").upsert({
    business_id: business.id,
    enabled: parsed.data.enabled,
    weeks_ahead: parsed.data.weeksAhead,
    timezone: DEFAULT_TZ,
    rules,
  });
  if (error) return { error: "Enregistrement impossible." };
  refresh();
  return { success: "Réglages enregistrés." };
}

// ---------------------------------------------------------------------------
// Planifier les contenus validés selon les règles
// ---------------------------------------------------------------------------
export async function planValidatedPosts(): Promise<Result> {
  const { supabase, user, business } = await getCurrentBusiness();
  if (!user || !business) return { error: "Renseignez d'abord votre commerce." };

  const { data: settings } = await supabase
    .from("autopilot_settings")
    .select("enabled, weeks_ahead, rules, timezone")
    .eq("business_id", business.id)
    .maybeSingle();
  if (!settings?.enabled) return { error: "Activez d'abord l'Autopilot et enregistrez vos jours de publication." };

  const rules = z.array(ruleSchema).safeParse(settings.rules);
  if (!rules.success || rules.data.length === 0) return { error: "Aucune règle de publication valide." };

  const now = new Date();
  const [{ data: pending }, { data: taken }] = await Promise.all([
    supabase
      .from("posts")
      .select("id, platform, scheduled_for")
      .eq("business_id", business.id)
      .eq("status", "ready")
      .eq("publish_status", "unscheduled"),
    supabase
      .from("posts")
      .select("scheduled_at")
      .eq("business_id", business.id)
      .in("publish_status", ["scheduled", "paused"])
      .gte("scheduled_at", now.toISOString()),
  ]);
  if (!pending?.length) return { error: "Aucun contenu validé en attente. Validez d'abord des contenus dans vos campagnes." };

  const slots = computeSlots(rules.data, now, settings.weeks_ahead, settings.timezone);
  const { assigned, unplaced } = assignSlots(
    pending,
    slots,
    (taken ?? []).map((t) => new Date(t.scheduled_at as string)),
    settings.timezone,
  );
  if (!assigned.length)
    return { error: "Aucun créneau disponible pour ces contenus. Ajoutez des jours ou allongez la durée de programmation." };

  for (const a of assigned) {
    await supabase
      .from("posts")
      .update({ scheduled_at: a.at.toISOString(), publish_status: "scheduled" })
      .eq("id", a.id)
      .eq("publish_status", "unscheduled");
  }
  await supabase.from("publish_events").insert(
    assigned.map((a) => ({ post_id: a.id, business_id: business.id, event: "scheduled", scheduled_at: a.at.toISOString(), detail: "Autopilot" })),
  );

  refresh();
  return {
    success: `${assigned.length} contenu${assigned.length > 1 ? "s" : ""} programmé${assigned.length > 1 ? "s" : ""}.${
      unplaced.length ? ` ${unplaced.length} sans créneau (plateforme sans jour de publication ou période trop courte).` : ""
    }`,
  };
}

// ---------------------------------------------------------------------------
// Actions sur un contenu
// ---------------------------------------------------------------------------
const id = z.string().uuid();

async function loadPost(postId: string) {
  const { supabase, user } = await getCurrentBusiness();
  if (!user || !id.safeParse(postId).success) return null;
  const { data } = await supabase
    .from("posts")
    .select("id, business_id, status, publish_status, scheduled_at")
    .eq("id", postId)
    .maybeSingle();
  return data ? { supabase, post: data } : null;
}

async function log(
  ctx: NonNullable<Awaited<ReturnType<typeof loadPost>>>,
  event: string,
  scheduledAt: string | null,
  detail?: string,
) {
  await ctx.supabase.from("publish_events").insert({
    post_id: ctx.post.id,
    business_id: ctx.post.business_id,
    event,
    scheduled_at: scheduledAt,
    detail: detail ?? null,
  });
}

/** Publication unique : programme (ou déplace) un contenu à une date et heure de Paris. */
export async function schedulePost(postId: string, day: string, time: string): Promise<Result> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return { error: "Date ou heure invalide." };
  const ctx = await loadPost(postId);
  if (!ctx) return { error: "Contenu introuvable." };
  if (ctx.post.status !== "ready") return { error: "Validez d'abord ce contenu." };
  if (ctx.post.publish_status === "published") return { error: "Ce contenu est déjà publié." };

  const at = zonedToUtc(day, time, DEFAULT_TZ);
  if (at.getTime() < Date.now() + 5 * 60_000) return { error: "Choisissez une date et une heure à venir." };

  const { error } = await ctx.supabase
    .from("posts")
    .update({ scheduled_at: at.toISOString(), publish_status: "scheduled", publish_error: null })
    .eq("id", postId);
  if (error) return { error: "Programmation impossible." };
  await log(ctx, ctx.post.scheduled_at ? "rescheduled" : "scheduled", at.toISOString());
  refresh();
  return { success: "Contenu programmé." };
}

export async function pausePost(postId: string): Promise<Result> {
  const ctx = await loadPost(postId);
  if (!ctx || ctx.post.publish_status !== "scheduled") return { error: "Ce contenu n'est pas programmé." };
  await ctx.supabase.from("posts").update({ publish_status: "paused" }).eq("id", postId);
  await log(ctx, "paused", ctx.post.scheduled_at);
  refresh();
  return {};
}

export async function resumePost(postId: string): Promise<Result> {
  const ctx = await loadPost(postId);
  if (!ctx || ctx.post.publish_status !== "paused") return { error: "Ce contenu n'est pas en pause." };
  await ctx.supabase.from("posts").update({ publish_status: "scheduled" }).eq("id", postId);
  await log(ctx, "resumed", ctx.post.scheduled_at);
  refresh();
  return {};
}

export async function cancelPost(postId: string): Promise<Result> {
  const ctx = await loadPost(postId);
  if (!ctx || !["scheduled", "paused", "failed"].includes(ctx.post.publish_status)) return { error: "Annulation impossible." };
  await ctx.supabase.from("posts").update({ publish_status: "unscheduled", scheduled_at: null }).eq("id", postId);
  await log(ctx, "canceled", ctx.post.scheduled_at);
  refresh();
  return {};
}

/** Le commerçant confirme avoir publié lui-même le contenu. */
export async function markPublished(postId: string): Promise<Result> {
  const ctx = await loadPost(postId);
  if (!ctx || ctx.post.publish_status === "published") return { error: "Action impossible." };
  await ctx.supabase.from("posts").update({ publish_status: "published", published_at: new Date().toISOString() }).eq("id", postId);
  await log(ctx, "published_manual", ctx.post.scheduled_at, "Publié manuellement par le commerçant");
  refresh();
  return {};
}
