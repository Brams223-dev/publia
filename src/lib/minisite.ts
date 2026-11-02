// Mini-site : réglages (module pur) et chargement des données publiques (serveur).

import { z } from "zod";

export const RESERVED_SLUGS = new Set([
  "admin", "api", "app", "aide", "avis", "b", "boutique", "carte", "catalogue", "connexion", "contact", "contacts", "inscription",
  "invitation", "mentions-legales", "parametres", "publia", "support", "tableau-de-bord",
]);

export function slugify(input: string) {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " et ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
}

export const siteSettingsSchema = z.object({
  headline: z.string().trim().max(120).default(""),
  about: z.string().trim().max(1500).default(""),
  show_catalogue: z.boolean().default(true),
  show_reviews: z.boolean().default(true),
  show_contact_form: z.boolean().default(true),
  show_hours: z.boolean().default(true),
  show_phone: z.boolean().default(true),
  show_address: z.boolean().default(true),
  google_review_url: z
    .string()
    .trim()
    .max(300)
    .default("")
    .refine((v) => v === "" || /^https:\/\/(g\.page|maps\.app\.goo\.gl|(www\.)?google\.[a-z.]+|search\.google\.com)\//.test(v), "Lien Google invalide (il doit commencer par https://g.page/, https://maps.app.goo.gl/ ou https://www.google.…)."),
});
export type SiteSettings = z.infer<typeof siteSettingsSchema>;

/** Lecture tolérante : une valeur invalide est remplacée par sa valeur par défaut, sans perdre les autres. */
export function readSettings(raw: unknown): SiteSettings {
  const src = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const out: Record<string, unknown> = {};
  for (const [key, field] of Object.entries(siteSettingsSchema.shape)) {
    const r = field.safeParse(src[key]);
    out[key] = r.success ? r.data : field.parse(undefined);
  }
  return out as SiteSettings;
}

export function validateSlug(slug: string): string | null {
  if (!/^[a-z0-9-]{3,60}$/.test(slug)) return "L'adresse doit contenir 3 à 60 caractères : lettres minuscules, chiffres et tirets.";
  if (slug.startsWith("-") || slug.endsWith("-") || slug.includes("--")) return "L'adresse ne doit pas commencer ou finir par un tiret.";
  if (RESERVED_SLUGS.has(slug)) return "Cette adresse est réservée. Choisissez-en une autre.";
  return null;
}

/** Moyenne des notes publiées, arrondie au dixième (null sans avis). */
export function averageRating(ratings: number[]) {
  if (!ratings.length) return null;
  return Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10;
}
