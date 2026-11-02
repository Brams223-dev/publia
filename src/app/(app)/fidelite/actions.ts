"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { canManage, getCurrentBusiness } from "@/lib/business";
import { checkRateLimit } from "@/lib/rate-limit";
import { normalizeEmail, normalizePhone } from "@/lib/contacts";
import { parseMoneyToCents } from "@/lib/commerce/money";

export type FormState = { error?: string; success?: string } | undefined;
type Result = { error?: string; ok?: boolean; code?: string };

function loyaltyError(message: string | undefined) {
  const m = message ?? "";
  if (m.includes("insufficient_balance")) return "Solde insuffisant pour utiliser la récompense.";
  if (m.includes("program_inactive")) return "Le programme de fidélité est désactivé.";
  if (m.includes("note_required")) return "Indiquez le motif de l'ajustement.";
  if (m.includes("invalid_amount")) return "Montant invalide.";
  if (m.includes("forbidden")) return "Action non autorisée.";
  return "L'opération n'a pas pu aboutir.";
}

const programSchema = z.object({
  kind: z.enum(["stamps", "points"]),
  stamps_required: z.coerce.number().int().min(2, "Au moins 2 tampons.").max(50, "50 tampons maximum."),
  points_per_euro: z.coerce.number().positive("Valeur invalide.").max(100),
  reward_threshold: z.coerce.number().int().min(1).max(100000),
  reward_label: z.string().trim().min(1, "Décrivez la récompense.").max(120),
  terms: z.string().trim().max(1000),
});

export async function saveProgram(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = programSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { supabase, business, role } = await getCurrentBusiness();
  if (!business) return { error: "Session expirée." };
  if (!canManage(role)) return { error: "Seuls le propriétaire et les administrateurs peuvent modifier le programme." };
  const limited = await checkRateLimit(supabase, "write");
  if (limited) return { error: limited };
  const { error } = await supabase
    .from("loyalty_programs")
    .upsert({ business_id: business.id, ...parsed.data, terms: parsed.data.terms || null, active: formData.get("active") === "on" }, { onConflict: "business_id" });
  if (error) return { error: "Enregistrement impossible." };
  revalidatePath("/fidelite");
  return { success: "Programme enregistré." };
}

export async function createCard(contactId: string): Promise<Result> {
  const { supabase, business } = await getCurrentBusiness();
  if (!business) return { error: "Session expirée." };
  const { data, error } = await supabase.rpc("loyalty_create_card", { p_contact: contactId });
  if (error) return { error: loyaltyError(error.message) };
  revalidatePath("/fidelite");
  redirect(`/fidelite?carte=${data}`);
}

const newCustomerSchema = z.object({
  first_name: z.string().trim().min(1, "Indiquez le prénom.").max(80),
  last_name: z.string().trim().max(80),
  email: z.string().trim().max(254),
  phone: z.string().trim().max(40),
  consent: z.string().optional(),
});

/** Inscription rapide en caisse : crée le contact puis sa carte. */
export async function enrollCustomer(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = newCustomerSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  const email = d.email ? normalizeEmail(d.email) : null;
  if (d.email && !email) return { error: "Adresse e-mail invalide." };
  const phone = d.phone ? normalizePhone(d.phone) : null;
  if (d.phone && !phone) return { error: "Numéro de téléphone invalide." };
  const { supabase, business } = await getCurrentBusiness();
  if (!business) return { error: "Session expirée." };
  const limited = await checkRateLimit(supabase, "write");
  if (limited) return { error: limited };

  let contactId: string | null = null;
  if (email) {
    const { data } = await supabase.from("contacts").select("id").eq("business_id", business.id).eq("email", email).maybeSingle();
    contactId = data?.id ?? null;
  }
  if (!contactId) {
    const consent = d.consent === "on";
    const { data, error } = await supabase
      .from("contacts")
      .insert({
        business_id: business.id,
        first_name: d.first_name,
        last_name: d.last_name || null,
        email,
        phone,
        source: "loyalty",
        marketing_consent: consent,
        consent_at: consent ? new Date().toISOString() : null,
        consent_source: consent ? "accord donné à l'inscription au programme de fidélité" : null,
      })
      .select("id")
      .single();
    if (error || !data) return { error: "Le client n'a pas pu être enregistré." };
    contactId = data.id;
  }
  const { data: card, error } = await supabase.rpc("loyalty_create_card", { p_contact: contactId });
  if (error) return { error: loyaltyError(error.message) };
  revalidatePath("/fidelite");
  redirect(`/fidelite?carte=${card}`);
}

export async function applyLoyalty(cardId: string, kind: "earn" | "redeem" | "adjust", input: { amount?: number; spend?: string; note?: string }): Promise<Result> {
  const { supabase, business } = await getCurrentBusiness();
  if (!business) return { error: "Session expirée." };
  const limited = await checkRateLimit(supabase, "write");
  if (limited) return { error: limited };
  let spendCents: number | null = null;
  if (input.spend !== undefined && input.spend !== "") {
    const c = parseMoneyToCents(input.spend);
    if (c === null || Number.isNaN(c)) return { error: "Montant d'achat invalide." };
    spendCents = c;
  }
  const { error } = await supabase.rpc("loyalty_apply", {
    p_card: cardId,
    p_kind: kind,
    p_amount: input.amount ?? null,
    p_spend_cents: spendCents,
    p_note: input.note?.slice(0, 200) ?? null,
  });
  if (error) return { error: loyaltyError(error.message) };
  revalidatePath("/fidelite");
  return { ok: true };
}

export async function rotateCardLink(cardId: string): Promise<Result> {
  const { supabase, business } = await getCurrentBusiness();
  if (!business) return { error: "Session expirée." };
  const { data, error } = await supabase.rpc("loyalty_rotate_code", { p_card: cardId });
  if (error) return { error: loyaltyError(error.message) };
  revalidatePath("/fidelite");
  return { ok: true, code: data as string };
}
