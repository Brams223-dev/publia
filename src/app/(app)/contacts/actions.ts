"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentBusiness } from "@/lib/business";
import { checkRateLimit } from "@/lib/rate-limit";
import { reportError } from "@/lib/observability";
import { contactsFromCsv, contactsToCsv, normalizeEmail, normalizePhone, normalizeTags } from "@/lib/contacts";

export type FormState = { error?: string; success?: string } | undefined;
type Result = { error?: string; ok?: boolean };

const contactSchema = z.object({
  id: z.string().uuid().optional().or(z.literal("").transform(() => undefined)),
  first_name: z.string().trim().max(80),
  last_name: z.string().trim().max(80),
  email: z.string().trim().max(254),
  phone: z.string().trim().max(40),
  tags: z.string().max(800),
  notes: z.string().trim().max(2000),
  consent: z.string().optional(),
  consent_source: z.string().trim().max(120),
});

/** Création ou modification d'un contact. Le consentement est daté et sa provenance enregistrée. */
export async function saveContact(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = contactSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  const email = d.email ? normalizeEmail(d.email) : null;
  if (d.email && !email) return { error: "Adresse e-mail invalide." };
  const phone = d.phone ? normalizePhone(d.phone) : null;
  if (d.phone && !phone) return { error: "Numéro de téléphone invalide." };
  if (!d.first_name && !d.last_name && !email && !phone) return { error: "Indiquez au moins un nom, un e-mail ou un téléphone." };
  const consent = d.consent === "on";
  if (consent && !d.consent_source) return { error: "Précisez comment le client a donné son accord (ex. : formulaire en boutique, oral au comptoir)." };

  const { supabase, user, business } = await getCurrentBusiness();
  if (!user || !business) return { error: "Session expirée." };
  const limited = await checkRateLimit(supabase, "write");
  if (limited) return { error: limited };

  let previous: { marketing_consent: boolean; consent_at: string | null; consent_source: string | null } | null = null;
  if (d.id) {
    const { data } = await supabase.from("contacts").select("marketing_consent, consent_at, consent_source").eq("id", d.id).eq("business_id", business.id).maybeSingle();
    if (!data) return { error: "Contact introuvable." };
    previous = data;
  }
  const keepConsent = consent && previous?.marketing_consent;
  const row = {
    business_id: business.id,
    first_name: d.first_name || null,
    last_name: d.last_name || null,
    email,
    phone,
    tags: normalizeTags(d.tags),
    notes: d.notes || null,
    marketing_consent: consent,
    consent_at: consent ? (keepConsent ? previous!.consent_at : new Date().toISOString()) : null,
    consent_source: consent ? (keepConsent ? previous!.consent_source : d.consent_source) : null,
  };

  const res = d.id
    ? await supabase.from("contacts").update(row).eq("id", d.id).select("id").single()
    : await supabase.from("contacts").insert({ ...row, source: "manual" }).select("id").single();
  if (res.error) {
    if (res.error.code === "23505") return { error: "Un contact existe déjà avec cette adresse e-mail." };
    await reportError("action", "saveContact", res.error, { userId: user.id });
    return { error: "Enregistrement impossible." };
  }
  revalidatePath("/contacts");
  if (!d.id) redirect(`/contacts/${res.data.id}`);
  revalidatePath(`/contacts/${d.id}`);
  return { success: "Contact enregistré." };
}

export async function deleteContact(id: string): Promise<Result> {
  const { supabase, business } = await getCurrentBusiness();
  if (!business) return { error: "Session expirée." };
  const { data, error } = await supabase.from("contacts").delete().eq("id", id).eq("business_id", business.id).select("id");
  if (error || !data?.length) return { error: "Suppression impossible." };
  revalidatePath("/contacts");
  redirect("/contacts");
}

export type ImportState = { error?: string; created?: number; updated?: number; skipped?: { line: number; reason: string }[] } | undefined;

/** Import CSV : met à jour les contacts existants (même e-mail), crée les autres. */
export async function importContacts(_: ImportState, formData: FormData): Promise<ImportState> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Choisissez un fichier CSV." };
  if (file.size > 2 * 1024 * 1024) return { error: "Fichier trop lourd (2 Mo maximum)." };
  const consentSource = String(formData.get("consent_source") ?? "").trim().slice(0, 80);
  const text = await file.text();
  const parsed = contactsFromCsv(text);
  if (!parsed.mapped.length) return { error: "Aucune colonne reconnue. Utilisez par exemple : Prénom ; Nom ; Email ; Téléphone ; Étiquettes ; Consentement." };
  if (!parsed.rows.length) return { error: "Aucun contact valide dans ce fichier.", skipped: parsed.skipped };
  const withConsent = parsed.rows.some((r) => r.marketing_consent);
  if (withConsent && !consentSource) return { error: "Votre fichier indique des consentements : précisez comment ils ont été recueillis." };

  const { supabase, user, business } = await getCurrentBusiness();
  if (!user || !business) return { error: "Session expirée." };
  const limited = await checkRateLimit(supabase, "upload");
  if (limited) return { error: limited };

  const emails = parsed.rows.map((r) => r.email).filter((e): e is string => Boolean(e));
  const existing = new Map<string, string>();
  for (let i = 0; i < emails.length; i += 200) {
    const { data } = await supabase.from("contacts").select("id, email").eq("business_id", business.id).in("email", emails.slice(i, i + 200));
    for (const c of data ?? []) if (c.email) existing.set(c.email.toLowerCase(), c.id);
  }
  const now = new Date().toISOString();
  const source = `import CSV « ${file.name.slice(0, 40)} » : ${consentSource}`.slice(0, 120);
  const toInsert = [];
  let updated = 0;
  for (const r of parsed.rows) {
    const consent = r.marketing_consent ? { marketing_consent: true, consent_at: now, consent_source: source } : {};
    const id = r.email ? existing.get(r.email) : undefined;
    if (id) {
      // Mise à jour prudente : on complète sans effacer, et on ne retire jamais un consentement existant.
      const patch = Object.fromEntries(Object.entries({ first_name: r.first_name, last_name: r.last_name, phone: r.phone, notes: r.notes }).filter(([, v]) => v));
      const { error } = await supabase.from("contacts").update({ ...patch, ...consent }).eq("id", id);
      if (!error) updated++;
    } else {
      toInsert.push({ business_id: business.id, ...r, ...consent, marketing_consent: r.marketing_consent, source: "import" });
    }
  }
  let created = 0;
  for (let i = 0; i < toInsert.length; i += 500) {
    const { data, error } = await supabase.from("contacts").insert(toInsert.slice(i, i + 500)).select("id");
    if (error) {
      await reportError("action", "importContacts", error, { userId: user.id });
      return { error: "L'import a été interrompu. Les contacts déjà importés sont conservés.", created, updated };
    }
    created += data?.length ?? 0;
  }
  revalidatePath("/contacts");
  return { created, updated, skipped: parsed.skipped };
}

export async function exportContacts(): Promise<{ error?: string; csv?: string; filename?: string }> {
  const { supabase, business } = await getCurrentBusiness();
  if (!business) return { error: "Session expirée." };
  const all = [];
  for (let from = 0; ; from += 1000) {
    const { data } = await supabase
      .from("contacts")
      .select("first_name, last_name, email, phone, tags, notes, marketing_consent, consent_at, consent_source, created_at, source")
      .eq("business_id", business.id)
      .order("created_at")
      .range(from, from + 999);
    all.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return { csv: contactsToCsv(all), filename: `contacts-${business.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40)}.csv` };
}

