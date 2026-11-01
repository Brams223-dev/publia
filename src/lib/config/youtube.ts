// Limites techniques YouTube (vérifiées le 2026-11-01).
// Sources : support.google.com/youtube/answer/72431,
// developers.google.com/youtube/v3/determine_quota_cost
// Ajuster ici si YouTube change ses règles : tout le code lit ce fichier.

export const YOUTUBE = {
  shorts: { width: 1080, height: 1920, ratio: "9:16", maxDurationSec: 180 },
  classic: { width: 1920, height: 1080, ratio: "16:9" },
  thumbnail: {
    width: 1280,
    height: 720,
    minWidth: 640,
    maxBytes: 2 * 1024 * 1024,
    mimeTypes: ["image/png", "image/jpeg"],
  },
  text: {
    titleMax: 100,
    descriptionMax: 5000,
    tagsTotalMax: 500,
    hashtagsMin: 3,
    hashtagsMax: 15,
  },
  api: {
    // videos.insert dispose de son propre quota (100 appels/jour par projet).
    uploadsPerDay: 100,
    dailyUnits: 10_000,
    cost: { thumbnailsSet: 50, channelsList: 1, videosUpdate: 50 },
    scopes: [
      "https://www.googleapis.com/auth/youtube.upload",
      "https://www.googleapis.com/auth/youtube.readonly",
    ],
  },
} as const;

export type YoutubeFormat = "shorts" | "classic";
