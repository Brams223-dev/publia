import "server-only";
// CreativeGenerator + AudienceRecommender : variantes publicitaires et ciblage conforme, via OpenAI.

import { z } from "zod";
import { generateStructured } from "@/lib/ai/openai";
import type { Business } from "@/lib/business";
import { AD_OBJECTIVES, platformById, type AdObjective, type AdPlatform } from "./config";

export const ADS_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["campaign_name", "variants", "audience"],
  properties: {
    campaign_name: { type: "string" },
    variants: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["angle", "headline", "primary_text", "description", "cta"],
        properties: {
          angle: { type: "string", description: "Angle créatif en quelques mots (ex. : bénéfice client, preuve de savoir-faire)" },
          headline: { type: "string" },
          primary_text: { type: "string" },
          description: { type: "string" },
          cta: { type: "string" },
        },
      },
    },
    audience: {
      type: "object",
      additionalProperties: false,
      required: ["radius_km", "age_min", "age_max", "interests", "rationale"],
      properties: {
        radius_km: { type: "integer" },
        age_min: { type: "integer" },
        age_max: { type: "integer" },
        interests: { type: "array", items: { type: "string" } },
        rationale: { type: "string" },
      },
    },
  },
} as const;

const resultSchema = z.object({
  campaign_name: z.string().trim().min(1),
  variants: z.array(
    z.object({
      angle: z.string().trim(),
      headline: z.string().trim().min(1),
      primary_text: z.string().trim().min(1),
      description: z.string().trim(),
      cta: z.string().trim(),
    }),
  ),
  audience: z.object({
    radius_km: z.number().int(),
    age_min: z.number().int(),
    age_max: z.number().int(),
    interests: z.array(z.string()),
    rationale: z.string().trim(),
  }),
});

// Catégories interdites au ciblage (politiques des régies + RGPD) : jamais utilisées comme centres d'intérêt.
const SENSITIVE = /(santé|maladie|médic|handicap|religio|églis|mosqu|synago|politi|parti |syndic|orientation|gay|lesbien|lgbt|ethni|origine|race|immigr|sexual|sexe|grossesse|enceinte|dette|crédit|pauvre|revenu|casier|alcoolis|drogue)/i;

const INSTRUCTIONS = `Tu es un expert en publicité locale pour les petits commerces en France. Tu prépares des créations publicitaires et une proposition de ciblage pour une campagne, qui sera relue et validée par le commerçant avant tout lancement.

RÈGLES ABSOLUES
- Français naturel, clair, sans jargon.
- N'invente JAMAIS de prix, de réduction, de promotion, de date, d'horaire, de garantie ou de résultat. N'utilise que les informations fournies.
- Aucune promesse trompeuse, aucun superlatif invérifiable (« le meilleur », « n°1 ») sauf s'il est fourni et justifié.
- Respecte les politiques publicitaires : pas d'attributs personnels interpellés (« Vous êtes malade ? », « Vous êtes célibataire ? »), pas de contenu discriminatoire.
- Le ciblage ne doit JAMAIS reposer sur des attributs sensibles ou déduits : santé, religion, opinions politiques, orientation sexuelle, origine, situation financière. Centres d'intérêt : uniquement des thèmes de consommation généraux (ex. : gastronomie, coiffure, décoration, sorties).
- Âge : 18 ans minimum. Rayon autour du commerce : entre 1 et 50 km, adapté à un commerce de proximité.
- Le bouton d'action ("cta") doit être exactement l'un des choix autorisés.
- Respecte les longueurs maximales indiquées pour chaque champ.
- Propose 4 variantes aux angles réellement différents pour permettre une comparaison.`;

export async function generateAdCreatives({
  business,
  platform,
  objective,
  offer,
  facts,
}: {
  business: Business;
  platform: AdPlatform;
  objective: AdObjective;
  offer: string;
  facts: string | null;
}) {
  const cfg = platformById(platform);
  const L = cfg.limits;
  const input = [
    "COMMERCE",
    `- Nom : ${business.name}`,
    business.category && `- Secteur : ${business.category}`,
    business.description && `- Description : ${business.description}`,
    business.products && `- Produits : ${business.products}`,
    business.services && `- Services : ${business.services}`,
    business.target_audience && `- Clientèle visée : ${business.target_audience}`,
    business.city && `- Ville : ${business.city}`,
    business.opening_hours && `- Horaires : ${business.opening_hours}`,
    "",
    "CAMPAGNE",
    `- Régie : ${cfg.name} (${cfg.detail})`,
    `- Objectif : ${AD_OBJECTIVES[objective]}`,
    `- Ce qu'il faut promouvoir : ${offer}`,
    facts ? `- Informations confirmées (seules utilisables) : ${facts}` : "- Aucun prix, aucune offre ni aucune date communiqués : n'en mentionne aucun.",
    "",
    "CONTRAINTES DE FORMAT",
    `- headline : ${L.headline} caractères maximum`,
    `- primary_text : ${L.primary} caractères maximum`,
    L.description ? `- description : ${L.description} caractères maximum` : "- description : chaîne vide (non utilisée sur cette régie)",
    `- cta, un choix parmi : ${cfg.ctas.join(" | ")}`,
  ]
    .filter(Boolean)
    .join("\n");

  const { data, model } = await generateStructured<unknown>({
    instructions: INSTRUCTIONS,
    input,
    schemaName: "publia_ads",
    schema: ADS_JSON_SCHEMA as unknown as Record<string, unknown>,
  });
  return { ...sanitize(resultSchema.parse(data), platform), model };
}

const clip = (s: string, max: number) => (max <= 0 ? "" : s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s);

/** Nettoyage serveur : longueurs, CTA autorisés, ciblage conforme. Exporté pour les tests. */
export function sanitize(r: z.infer<typeof resultSchema>, platform: AdPlatform) {
  const cfg = platformById(platform);
  const variants = r.variants.slice(0, 5).map((v) => ({
    angle: clip(v.angle, 120),
    headline: clip(v.headline, cfg.limits.headline),
    primary_text: clip(v.primary_text, cfg.limits.primary),
    description: clip(v.description, cfg.limits.description),
    cta: cfg.ctas.includes(v.cta) ? v.cta : cfg.ctas[0],
  }));
  if (!variants.length) throw new Error("Aucune variante exploitable");

  const ageMin = Math.min(Math.max(18, r.audience.age_min), 64);
  const ageMax = Math.max(Math.min(65, r.audience.age_max), ageMin + 1);
  return {
    name: clip(r.campaign_name, 120),
    variants,
    audience: {
      radius_km: Math.min(Math.max(1, r.audience.radius_km), 50),
      age_min: ageMin,
      age_max: ageMax,
      interests: Array.from(new Set(r.audience.interests.map((i) => i.trim()).filter((i) => i && !SENSITIVE.test(i)))).slice(0, 8),
      rationale: clip(r.audience.rationale, 400),
    },
  };
}
