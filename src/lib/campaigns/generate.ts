import "server-only";
import { z } from "zod";
import { generateStructured } from "@/lib/ai";
import type { Business } from "@/lib/business";
import { FORMATS_BY_PLATFORM, LIMITS, OBJECTIVES, type CampaignPlatform, type ObjectiveId } from "./config";
import { TONES } from "@/lib/config/business";
import { YOUTUBE } from "@/lib/config/youtube";

// ---------------------------------------------------------------------------
// Schéma de sortie (JSON Schema strict pour OpenAI + validation Zod côté serveur)
// ---------------------------------------------------------------------------
const ALL_FORMATS = ["post", "story", "reel", "video_courte", "short"] as const;

export const CAMPAIGN_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["title", "summary", "strategy", "items"],
  properties: {
    title: { type: "string", description: "Nom court de la campagne (max 80 caractères)" },
    summary: { type: "string", description: "Résumé de la campagne en 1 à 2 phrases" },
    strategy: { type: "string", description: "Pourquoi ce plan fonctionne, en 2 à 3 phrases simples" },
    items: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["platform", "format", "day", "title", "caption", "short_caption", "hashtags", "call_to_action", "visual_idea"],
        properties: {
          platform: { type: "string", enum: ["instagram", "facebook", "tiktok", "youtube"] },
          format: { type: "string", enum: [...ALL_FORMATS] },
          day: { type: "integer", description: "Jour de diffusion conseillé, 1 = premier jour de la campagne" },
          title: { type: "string", description: "Accroche / titre. Pour YouTube : titre de la vidéo (max 100 caractères)" },
          caption: { type: "string", description: "Texte complet prêt à publier (ou script court pour une vidéo)" },
          short_caption: { type: "string", description: "Version courte (max 150 caractères)" },
          hashtags: { type: "array", items: { type: "string" } },
          call_to_action: { type: "string" },
          visual_idea: { type: "string", description: "Idée de visuel ou de plan vidéo à réaliser avec les photos du commerce" },
        },
      },
    },
  },
} as const;

const itemSchema = z.object({
  platform: z.enum(["instagram", "facebook", "tiktok", "youtube"]),
  format: z.enum(ALL_FORMATS),
  day: z.number().int(),
  title: z.string().trim().min(1),
  caption: z.string().trim().min(1),
  short_caption: z.string().trim(),
  hashtags: z.array(z.string()),
  call_to_action: z.string().trim(),
  visual_idea: z.string().trim(),
});

const campaignSchema = z.object({
  title: z.string().trim().min(1),
  summary: z.string().trim(),
  strategy: z.string().trim(),
  items: z.array(itemSchema),
});

export type GeneratedItem = z.infer<typeof itemSchema>;
export type GeneratedCampaign = z.infer<typeof campaignSchema>;

// ---------------------------------------------------------------------------
// Prompt
// ---------------------------------------------------------------------------
const INSTRUCTIONS = `Tu es le responsable marketing d'un commerce de proximité en France. Tu prépares une campagne de communication complète, prête à être relue et validée par le commerçant.

RÈGLES ABSOLUES
- Écris en français naturel, chaleureux et clair, adapté au métier et au ton demandé.
- N'invente JAMAIS de prix, de pourcentage de réduction, de promotion, d'horaires, de dates, d'adresse, de numéro, de produit ou de caractéristique qui ne figurent pas dans les informations fournies. Si une information manque, formule sans elle.
- N'utilise que les coordonnées fournies dans les appels à l'action. Sans coordonnées, propose une action simple (passer en boutique, envoyer un message).
- Ne promets jamais de résultat garanti. Pas de fausses statistiques ni de faux avis clients.
- Respecte les plateformes et formats demandés uniquement.

CONVENTIONS PAR PLATEFORME
- Instagram publication : accroche forte en première ligne, texte aéré, emojis avec modération, 5 à 10 hashtags.
- Instagram story : très court (1 à 2 phrases), un seul message, une action claire.
- Instagram reel / TikTok : "caption" = script de 15 à 30 secondes découpé en plans courts, accroche dans les 2 premières secondes ; "short_caption" = légende.
- Facebook : ton communautaire et local, phrases complètes, 0 à 3 hashtags.
- YouTube Shorts : "title" = titre de ${YOUTUBE.text.titleMax} caractères maximum avec le mot-clé principal au début ; "caption" = script court ; "short_caption" = description courte ; inclure #Shorts dans les hashtags.

PLANIFICATION
- Répartis les contenus sur la durée, en commençant par faire connaître puis en concluant par une relance.
- Varie les angles : présentation, coulisses, bénéfice client, rappel.
- Hashtags en français, pertinents, sans espace, commençant par #. Ajoute un hashtag de ville si la ville est fournie.`;

function line(label: string, value: string | null | undefined) {
  return value ? `- ${label} : ${value}` : null;
}

export function buildCampaignInput({
  business,
  objective,
  brief,
  facts,
  platforms,
  durationDays,
}: {
  business: Business;
  objective: ObjectiveId;
  brief: string;
  facts: string | null;
  platforms: CampaignPlatform[];
  durationDays: number;
}) {
  const tone = TONES.find((t) => t.id === business.tone)?.label ?? "Chaleureux";
  const objectiveLabel = OBJECTIVES.find((o) => o.id === objective)?.label ?? objective;
  const formats = platforms.map((p) => `${p} (${FORMATS_BY_PLATFORM[p].join(", ")})`).join(" ; ");
  const socials = Object.entries(business.social_links ?? {})
    .filter(([, v]) => v)
    .map(([k, v]) => `${k} ${v}`)
    .join(", ");

  return [
    "COMMERCE",
    line("Nom", business.name),
    line("Secteur", business.category),
    line("Description", business.description),
    line("Produits", business.products),
    line("Services", business.services),
    line("Public cible", business.target_audience),
    line("Ville", business.city),
    line("Adresse", business.address),
    line("Horaires", business.opening_hours),
    line("Téléphone", business.phone),
    line("Site internet", business.website),
    line("Réseaux sociaux", socials || null),
    line("Objectifs du commerce", business.goals),
    `- Ton de communication : ${tone}`,
    "",
    "DEMANDE DU COMMERÇANT",
    `- Objectif : ${objectiveLabel}`,
    `- Description : ${brief}`,
    facts ? `- Informations confirmées par le commerçant (seules informations commerciales utilisables) : ${facts}` : "- Aucune offre, aucun prix ni aucune date n'ont été communiqués : n'en mentionne aucun.",
    `- Durée : ${durationDays} jours (jours numérotés de 1 à ${durationDays})`,
    `- Plateformes et formats autorisés : ${formats}`,
    `- Nombre de contenus : entre ${Math.max(LIMITS.itemsMin, platforms.length)} et ${Math.min(LIMITS.itemsMax, platforms.length * (durationDays === 7 ? 2 : 3) + 2)}, répartis entre les plateformes.`,
  ]
    .filter((l) => l !== null)
    .join("\n");
}

// ---------------------------------------------------------------------------
// Génération + nettoyage
// ---------------------------------------------------------------------------
const clip = (s: string, max: number) => (s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s);

function normalizeHashtags(tags: string[], platform: CampaignPlatform, format: string) {
  const clean = tags
    .map((t) => t.trim().replace(/\s+/g, ""))
    .filter(Boolean)
    .map((t) => (t.startsWith("#") ? t : `#${t}`));
  if (platform === "youtube" && format === "short" && !clean.some((t) => t.toLowerCase() === "#shorts")) clean.unshift("#Shorts");
  return Array.from(new Set(clean)).slice(0, LIMITS.hashtagsMax);
}

export async function generateCampaign(args: Parameters<typeof buildCampaignInput>[0]) {
  const { data, model } = await generateStructured<unknown>({
    instructions: INSTRUCTIONS,
    input: buildCampaignInput(args),
    schemaName: "campagne_publia",
    schema: CAMPAIGN_JSON_SCHEMA as unknown as Record<string, unknown>,
  });

  const parsed = campaignSchema.parse(data);
  const allowed = new Set(args.platforms);

  const items = parsed.items
    // Garde uniquement les plateformes et formats demandés.
    .filter((i) => allowed.has(i.platform) && FORMATS_BY_PLATFORM[i.platform].includes(i.format))
    .slice(0, LIMITS.itemsMax)
    .map((i) => ({
      ...i,
      day: Math.min(Math.max(1, i.day), args.durationDays),
      title: clip(i.title, i.platform === "youtube" ? YOUTUBE.text.titleMax : LIMITS.titleMax),
      caption: clip(i.caption, LIMITS.captionMax),
      short_caption: clip(i.short_caption, LIMITS.shortCaptionMax),
      hashtags: normalizeHashtags(i.hashtags, i.platform, i.format),
    }))
    .sort((a, b) => a.day - b.day);

  if (items.length === 0) throw new Error("Aucun contenu exploitable");

  return {
    campaign: {
      title: clip(parsed.title, 80),
      summary: clip(parsed.summary, 400),
      strategy: clip(parsed.strategy, 800),
      items,
    },
    model,
  };
}
