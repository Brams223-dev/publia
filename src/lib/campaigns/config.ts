// Configuration de « Fais ma communication » — partagée front/serveur.

export const OBJECTIVES = [
  { id: "promotion", label: "Faire une promotion", hint: "Mettre en avant une offre que vous proposez" },
  { id: "nouveaute", label: "Annoncer une nouveauté", hint: "Nouveau produit, service ou arrivage" },
  { id: "evenement", label: "Promouvoir un événement", hint: "Soirée, atelier, ouverture, portes ouvertes" },
  { id: "nouveaux_clients", label: "Attirer de nouveaux clients", hint: "Se faire connaître dans le quartier" },
  { id: "fidelisation", label: "Fidéliser mes clients", hint: "Remercier, faire revenir, créer du lien" },
  { id: "saison", label: "Campagne de saison", hint: "Fêtes, rentrée, été, Saint-Valentin…" },
  { id: "notoriete", label: "Développer ma notoriété", hint: "Montrer mon savoir-faire et mon équipe" },
] as const;
export type ObjectiveId = (typeof OBJECTIVES)[number]["id"];

export const CAMPAIGN_PLATFORMS = [
  { id: "instagram", label: "Instagram", detail: "Publications, Stories, Reels" },
  { id: "facebook", label: "Facebook", detail: "Publications" },
  { id: "tiktok", label: "TikTok", detail: "Vidéos courtes" },
  { id: "youtube", label: "YouTube Shorts", detail: "Vidéos verticales" },
] as const;
export type CampaignPlatform = (typeof CAMPAIGN_PLATFORMS)[number]["id"];

export const FORMATS_BY_PLATFORM: Record<CampaignPlatform, readonly string[]> = {
  instagram: ["post", "story", "reel"],
  facebook: ["post"],
  tiktok: ["video_courte"],
  youtube: ["short"],
};

export const FORMAT_LABELS: Record<string, string> = {
  post: "Publication",
  story: "Story",
  reel: "Reel",
  video_courte: "Vidéo courte",
  short: "Short",
  video: "Vidéo",
};

export const DURATIONS = [7, 14] as const;

export const LIMITS = {
  briefMin: 10,
  briefMax: 600,
  factsMax: 1000,
  itemsMin: 3,
  itemsMax: 14,
  titleMax: 100,
  captionMax: 2200,
  shortCaptionMax: 300,
  hashtagsMax: 12,
};
