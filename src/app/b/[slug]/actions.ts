"use server";

import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPublicSite, publicRateLimit, visitorKey } from "@/lib/public-site";
import { normalizeEmail, normalizePhone } from "@/lib/contacts";
import { reportError } from "@/lib/observability";

export type PublicFormState = { error?: string; success?: string } | undefined;

const messageSchema = z.object({
  slug: z.string(),
  name: z.string().trim().min(2, "Indiquez votre nom.").max(120),
  email: z.string().trim().max(254),
  phone: z.string().trim().max(40),
  subject: z.string().trim().max(150),
  body: z.string().trim().min(5, "Votre message est trop court.").max(3000, "3 000 caractères maximum."),
  marketing: z.string().optional(),
  website: z.string().optional(), // piège à robots : doit rester vide
});

/** Formulaire de contact du mini-site → Inbox du commerce (+ fiche contact). */
export async function sendMessage(_: PublicFormState, formData: FormData): Promise<PublicFormState> {
  const parsed = messageSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  if (d.website) return { success: "Message envoyé." }; // robot : on ne dit rien
  const email = d.email ? normalizeEmail(d.email) : null;
  if (d.email && !email) return { error: "Adresse e-mail invalide." };
  const phone = d.phone ? normalizePhone(d.phone) : null;
  if (d.phone && !phone) return { error: "Numéro de téléphone invalide." };
  if (!email && !phone) return { error: "Indiquez un e-mail ou un téléphone pour qu'on puisse vous répondre." };

  const site = await getPublicSite(d.slug);
  if (!site || !site.settings.show_contact_form) return { error: "Ce formulaire n'est pas disponible." };
  const ok = (await publicRateLimit(await visitorKey("msg"), 5, 600)) && (await publicRateLimit(`msg-biz:${site.businessId}`, 100, 86400));
  if (!ok) return { error: "Trop de messages envoyés. Réessayez un peu plus tard." };

  try {
    const admin = createAdminClient();
    const marketing = d.marketing === "on";
    let contactId: string | null = null;
    const [first, ...rest] = d.name.split(/\s+/);
    if (email) {
      const { data: existing } = await admin.from("contacts").select("id, marketing_consent").eq("business_id", site.businessId).eq("email", email).maybeSingle();
      if (existing) {
        contactId = existing.id;
        await admin
          .from("contacts")
          .update({
            last_interaction_at: new Date().toISOString(),
            ...(marketing && !existing.marketing_consent ? { marketing_consent: true, consent_at: new Date().toISOString(), consent_source: "case cochée sur le formulaire du mini-site" } : {}),
          })
          .eq("id", existing.id);
      }
    }
    if (!contactId) {
      const { data: created } = await admin
        .from("contacts")
        .insert({
          business_id: site.businessId,
          first_name: first.slice(0, 80),
          last_name: rest.join(" ").slice(0, 80) || null,
          email,
          phone,
          source: "minisite",
          marketing_consent: marketing,
          consent_at: marketing ? new Date().toISOString() : null,
          consent_source: marketing ? "case cochée sur le formulaire du mini-site" : null,
          last_interaction_at: new Date().toISOString(),
        })
        .select("id")
        .single();
      contactId = created?.id ?? null;
    }
    const { error } = await admin.from("inbox_messages").insert({
      business_id: site.businessId,
      contact_id: contactId,
      name: d.name,
      email,
      phone,
      subject: d.subject || null,
      body: d.body,
    });
    if (error) throw error;
  } catch (e) {
    await reportError("action", "sendMessage", e, { route: `/b/${d.slug}` });
    return { error: "Le message n'a pas pu être envoyé. Réessayez dans un instant." };
  }
  return { success: `Merci ! Votre message a bien été transmis à ${site.name}.` };
}

const reviewSchema = z.object({
  slug: z.string(),
  author_name: z.string().trim().min(2, "Indiquez votre prénom ou un pseudonyme.").max(80),
  rating: z.coerce.number().int().min(1, "Choisissez une note.").max(5),
  comment: z.string().trim().max(2000, "2 000 caractères maximum."),
  email: z.string().trim().max(254),
  agree: z.literal("on", { message: "Acceptez la publication de votre avis pour continuer." }),
  website: z.string().optional(),
});

/** Dépôt d'un avis : enregistré « en attente », publié après modération (motifs : contenu illicite ou hors sujet). */
export async function submitReview(_: PublicFormState, formData: FormData): Promise<PublicFormState> {
  const parsed = reviewSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  if (d.website) return { success: "Merci pour votre avis." };
  const email = d.email ? normalizeEmail(d.email) : null;
  if (d.email && !email) return { error: "Adresse e-mail invalide." };

  const site = await getPublicSite(d.slug);
  if (!site || !site.settings.show_reviews) return { error: "Les avis ne sont pas ouverts pour ce commerce." };
  const ok = (await publicRateLimit(await visitorKey(`avis:${site.businessId}`), 2, 86400)) && (await publicRateLimit(`avis-biz:${site.businessId}`, 200, 86400));
  if (!ok) return { error: "Vous avez déjà déposé un avis récemment. Merci !" };

  try {
    const admin = createAdminClient();
    let contactId: string | null = null;
    if (email) {
      const { data: existing } = await admin.from("contacts").select("id").eq("business_id", site.businessId).eq("email", email).maybeSingle();
      contactId = existing?.id ?? null;
      if (!contactId) {
        const { data: created } = await admin
          .from("contacts")
          .insert({ business_id: site.businessId, first_name: d.author_name.slice(0, 80), email, source: "review", last_interaction_at: new Date().toISOString() })
          .select("id")
          .single();
        contactId = created?.id ?? null;
      }
    }
    const { error } = await admin.from("reviews").insert({
      business_id: site.businessId,
      contact_id: contactId,
      author_name: d.author_name,
      rating: d.rating,
      comment: d.comment || null,
    });
    if (error) throw error;
  } catch (e) {
    await reportError("action", "submitReview", e, { route: `/b/${d.slug}/avis` });
    return { error: "Votre avis n'a pas pu être enregistré. Réessayez dans un instant." };
  }
  return { success: "Merci ! Votre avis a été transmis et sera publié après vérification." };
}
