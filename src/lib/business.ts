import "server-only";
import { getUser } from "@/lib/supabase/server";
import { DEFAULT_COLORS, type BrandColors } from "@/lib/config/business";

export type SocialLinks = Partial<Record<"instagram" | "facebook" | "tiktok" | "youtube", string>>;

export type Business = {
  id: string;
  name: string;
  category: string | null;
  description: string | null;
  address: string | null;
  city: string | null;
  phone: string | null;
  website: string | null;
  tone: string | null;
  brand_colors: BrandColors;
  logo_url: string | null;
  products: string | null;
  services: string | null;
  target_audience: string | null;
  opening_hours: string | null;
  social_links: SocialLinks;
  goals: string | null;
  /** Marché du commerce (src/config/markets.ts). */
  country_code: string;
  locale: string;
  currency: string;
  timezone: string;
};

const COLUMNS =
  "id, name, category, description, address, city, phone, website, tone, brand_colors, logo_url, products, services, target_audience, opening_hours, social_links, goals, country_code, locale, currency, timezone";

/** Commerce principal de l'utilisateur connecté (V1 : un commerce par compte). */
export async function getCurrentBusiness() {
  const { supabase, user } = await getUser();
  if (!user) return { supabase, user, business: null as Business | null };
  const { data } = await supabase
    .from("businesses")
    .select(COLUMNS)
    .eq("owner_id", user.id)
    .order("created_at")
    .limit(1)
    .maybeSingle();
  const business = data
    ? ({
        ...data,
        brand_colors: { ...DEFAULT_COLORS, ...(data.brand_colors ?? {}) },
        social_links: (data.social_links ?? {}) as SocialLinks,
      } as Business)
    : null;
  return { supabase, user, business };
}

/** Taux de complétude du profil, pour guider le commerçant. */
export function profileCompleteness(b: Business | null) {
  if (!b) return 0;
  const fields = [b.name, b.category, b.description, b.city, b.tone, b.products || b.services, b.target_audience, b.logo_url];
  return Math.round((fields.filter(Boolean).length / fields.length) * 100);
}
