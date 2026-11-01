// Plateformes et formats pris en charge par Publia.
// Toute validation (front et serveur) lit ce fichier : une seule source de vérité.

export const PLATFORMS = ["instagram", "tiktok", "facebook", "youtube"] as const;
export type Platform = (typeof PLATFORMS)[number];

export const PLATFORM_LABELS: Record<Platform, string> = {
  instagram: "Instagram",
  tiktok: "TikTok",
  facebook: "Facebook",
  youtube: "YouTube",
};

export type Format = {
  id: string;
  label: string;
  width: number;
  height: number;
  ratio: "1:1" | "4:5" | "9:16" | "16:9";
  kind: "image" | "video";
};

export const FORMATS: Record<Platform, Format[]> = {
  instagram: [
    { id: "ig_square", label: "Publication carrée", width: 1080, height: 1080, ratio: "1:1", kind: "image" },
    { id: "ig_portrait", label: "Publication portrait", width: 1080, height: 1350, ratio: "4:5", kind: "image" },
    { id: "ig_story", label: "Story / Reel", width: 1080, height: 1920, ratio: "9:16", kind: "video" },
  ],
  tiktok: [
    { id: "tt_vertical", label: "Vidéo verticale", width: 1080, height: 1920, ratio: "9:16", kind: "video" },
  ],
  facebook: [
    { id: "fb_square", label: "Publication carrée", width: 1080, height: 1080, ratio: "1:1", kind: "image" },
    { id: "fb_video", label: "Vidéo carrée", width: 1080, height: 1080, ratio: "1:1", kind: "video" },
  ],
  youtube: [
    { id: "yt_shorts", label: "YouTube Shorts", width: 1080, height: 1920, ratio: "9:16", kind: "video" },
    { id: "yt_classic", label: "Vidéo classique", width: 1920, height: 1080, ratio: "16:9", kind: "video" },
    { id: "yt_thumbnail", label: "Miniature YouTube", width: 1280, height: 720, ratio: "16:9", kind: "image" },
  ],
};
