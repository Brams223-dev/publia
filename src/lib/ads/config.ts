import { messages } from "@/i18n";

// Publia Ads — configuration des plateformes (CampaignBuilder).
// Objectifs alignés sur les types de campagnes réellement proposés par chaque régie.
// Limites de texte : longueurs recommandées par les régies, appliquées par prudence.

export type AdPlatform = "meta" | "tiktok" | "google" | "youtube";

export const AD_OBJECTIVES = {
  notoriete: "Notoriété",
  portee: "Portée",
  trafic: "Trafic",
  interactions: "Interactions",
  prospects: "Prospects",
  appels: "Appels",
  ventes: "Ventes",
  promotion_produit: "Promotion de produits",
  promotion_video: "Promotion vidéo",
} as const;
export type AdObjective = keyof typeof AD_OBJECTIVES;

export type PlatformConfig = {
  id: AdPlatform;
  name: string;
  detail: string;
  objectives: AdObjective[];
  ctas: string[];
  limits: { headline: number; primary: number; description: number };
  preview: "feed" | "vertical" | "search" | "video";
  connection: string;
};

export const AD_PLATFORMS: PlatformConfig[] = [
  {
    id: "meta",
    name: "Meta Ads",
    detail: "Facebook et Instagram",
    objectives: ["notoriete", "portee", "trafic", "interactions", "prospects", "appels", "ventes", "promotion_produit", "promotion_video"],
    ctas: ["En savoir plus", "Réserver", "Acheter", "Commander", "Nous contacter", "Appeler", "S'inscrire", "Obtenir l'itinéraire"],
    limits: { headline: 40, primary: 125, description: 30 },
    preview: "feed",
    connection: "Compte publicitaire Meta (Business Manager) et application Meta validée pour l'API Marketing.",
  },
  {
    id: "tiktok",
    name: "TikTok Ads",
    detail: "Vidéos verticales",
    objectives: ["portee", "trafic", "promotion_video", "interactions", "prospects", "ventes"],
    ctas: ["En savoir plus", "Acheter", "Réserver", "Nous contacter", "S'inscrire", "Commander"],
    limits: { headline: 40, primary: 100, description: 0 },
    preview: "vertical",
    connection: "Compte TikTok Ads Manager et application TikTok for Business approuvée pour l'API Marketing.",
  },
  {
    id: "google",
    name: "Google Ads",
    detail: "Réseau de Recherche",
    objectives: ["ventes", "prospects", "trafic", "appels", "notoriete"],
    ctas: ["En savoir plus", "Appeler", "Réserver", "Commander", "Demander un devis"],
    limits: { headline: 30, primary: 90, description: 90 },
    preview: "search",
    connection: "Compte Google Ads et jeton développeur de l'API Google Ads (accès validé par Google).",
  },
  {
    id: "youtube",
    name: "YouTube Ads",
    detail: "Campagnes vidéo via Google Ads",
    objectives: ["notoriete", "promotion_video", "trafic", "ventes"],
    ctas: ["En savoir plus", "Réserver", "Acheter", "Nous contacter"],
    limits: { headline: 40, primary: 90, description: 0 },
    preview: "video",
    connection: "Compte Google Ads relié à la chaîne YouTube, avec accès à l'API Google Ads.",
  },
];

export const platformById = (id: string) => AD_PLATFORMS.find((p) => p.id === id) ?? AD_PLATFORMS[0];

const S = messages.adStatus;
export const AD_STATUS: Record<string, { label: string; cls: string }> = {
  draft: { label: S.draft, cls: "bg-amber-50 text-amber-800" },
  ready: { label: S.ready, cls: "bg-brand-soft text-brand" },
  pending_launch: { label: S.pending_launch, cls: "bg-brand-soft text-brand" },
  active: { label: S.active, cls: "bg-success/10 text-success" },
  paused: { label: S.paused, cls: "bg-neutral-100 text-neutral-700" },
  completed: { label: S.completed, cls: "bg-neutral-100 text-neutral-700" },
  archived: { label: S.archived, cls: "bg-neutral-100 text-neutral-500" },
};
