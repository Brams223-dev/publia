export const SECTORS = [
  "Restaurant",
  "Café / Bar",
  "Boulangerie / Pâtisserie",
  "Coiffeur / Barbier",
  "Institut de beauté",
  "Fleuriste",
  "Garage / Automobile",
  "Boutique / Commerce",
  "Artisan",
  "Santé / Bien-être",
  "Autre",
] as const;

export const TONES = [
  { id: "professionnel", label: "Professionnel" },
  { id: "chaleureux", label: "Chaleureux" },
  { id: "elegant", label: "Élégant" },
  { id: "dynamique", label: "Dynamique" },
  { id: "moderne", label: "Moderne" },
  { id: "humoristique", label: "Humoristique" },
  { id: "premium", label: "Premium" },
  { id: "familial", label: "Familial" },
] as const;

export type ToneId = (typeof TONES)[number]["id"];

export type BrandColors = { primary: string; secondary: string; text: string };

export const DEFAULT_COLORS: BrandColors = { primary: "#6B55D9", secondary: "#8B78EC", text: "#25243A" };

// Limites d'import (doivent rester ≤ aux limites des buckets Supabase).
export const LOGO_MAX_BYTES = 5 * 1024 * 1024;
export const PHOTO_MAX_BYTES = 15 * 1024 * 1024;
export const LOGO_TYPES = ["image/png", "image/jpeg", "image/webp"];
export const PHOTO_TYPES = ["image/png", "image/jpeg", "image/webp"];
export const MAX_PHOTOS = 20;
