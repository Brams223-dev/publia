export const STUDIO_FORMATS = [
  { id: "ig_square", label: "Instagram carré", short: "1:1", width: 1080, height: 1080 },
  { id: "ig_portrait", label: "Instagram portrait", short: "4:5", width: 1080, height: 1350 },
  { id: "ig_story", label: "Story / Reel", short: "9:16", width: 1080, height: 1920 },
  { id: "fb_square", label: "Facebook", short: "1:1", width: 1080, height: 1080 },
  { id: "yt_thumbnail", label: "Miniature YouTube", short: "16:9", width: 1280, height: 720 },
] as const;

export type StudioFormat = (typeof STUDIO_FORMATS)[number]["id"];

export const formatById = (id: string) => STUDIO_FORMATS.find((f) => f.id === id) ?? STUDIO_FORMATS[0];

export const TEMPLATE_CATEGORIES = [
  { id: "promotion", label: "Promotion" },
  { id: "nouveaute", label: "Nouveauté" },
  { id: "produit", label: "Produit" },
  { id: "service", label: "Service" },
  { id: "evenement", label: "Événement" },
  { id: "annonce", label: "Annonce" },
] as const;
export type TemplateCategory = (typeof TEMPLATE_CATEGORIES)[number]["id"];

/** Format conseillé pour une plateforme et un format de contenu de campagne. */
export function formatForPost(platform: string, format: string | null): StudioFormat {
  if (platform === "youtube") return "yt_thumbnail";
  if (format === "story" || format === "reel" || format === "video_courte" || platform === "tiktok") return "ig_story";
  if (platform === "facebook") return "fb_square";
  return "ig_portrait";
}
