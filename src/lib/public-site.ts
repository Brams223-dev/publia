import "server-only";
// Lecture des données publiques d'un mini-site (clé serveur, filtrage strict : publié uniquement).
// Rien n'est exposé au client hors de ce qui est affiché sur la page publique.

import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { DEFAULT_COLORS, type BrandColors } from "@/lib/config/business";
import { readSettings, type SiteSettings } from "@/lib/minisite";

export type PublicSite = {
  businessId: string;
  slug: string;
  name: string;
  category: string | null;
  description: string | null;
  address: string | null;
  city: string | null;
  phone: string | null;
  website: string | null;
  openingHours: string | null;
  socialLinks: Record<string, string>;
  colors: BrandColors;
  logoUrl: string | null;
  currency: string;
  countryCode: string;
  settings: SiteSettings;
};

export async function getPublicSite(slug: string): Promise<PublicSite | null> {
  if (!isAdminConfigured() || !/^[a-z0-9-]{3,60}$/.test(slug)) return null;
  const admin = createAdminClient();
  const { data: shop } = await admin.from("shops").select("business_id, slug, name, settings, published").eq("slug", slug).eq("published", true).maybeSingle();
  if (!shop) return null;
  const { data: b } = await admin
    .from("businesses")
    .select("id, name, category, description, address, city, phone, website, opening_hours, social_links, brand_colors, logo_url, currency, country_code")
    .eq("id", shop.business_id)
    .maybeSingle();
  if (!b) return null;
  const logoUrl = b.logo_url ? (await admin.storage.from("brand-assets").createSignedUrl(b.logo_url, 3600)).data?.signedUrl ?? null : null;
  return {
    businessId: b.id,
    slug: shop.slug!,
    name: shop.name || b.name,
    category: b.category,
    description: b.description,
    address: b.address,
    city: b.city,
    phone: b.phone,
    website: b.website,
    openingHours: b.opening_hours,
    socialLinks: (b.social_links ?? {}) as Record<string, string>,
    colors: { ...DEFAULT_COLORS, ...(b.brand_colors ?? {}) },
    logoUrl,
    currency: b.currency,
    countryCode: b.country_code,
    settings: readSettings(shop.settings),
  };
}

export async function getPublicProducts(businessId: string, limit = 24) {
  const admin = createAdminClient();
  const { data } = await admin
    .from("products")
    .select("id, name, description, price_cents, compare_at_cents, unit, stock_policy, stock_quantity, has_variants, product_media(file_path, sort_order)")
    .eq("business_id", businessId)
    .eq("status", "active")
    .neq("compliance_status", "blocked")
    .order("created_at", { ascending: false })
    .limit(limit);
  const list = (data ?? []).map((p) => {
    const media = [...(p.product_media ?? [])].sort((a, b) => a.sort_order - b.sort_order);
    return { ...p, cover: media[0]?.file_path ?? null };
  });
  const paths = list.map((p) => p.cover).filter((x): x is string => Boolean(x));
  const signed = new Map<string, string>();
  if (paths.length) {
    const { data: urls } = await admin.storage.from("uploads").createSignedUrls(paths, 3600);
    for (const u of urls ?? []) if (u.path && u.signedUrl) signed.set(u.path, u.signedUrl);
  }
  return list.map((p) => ({ ...p, imageUrl: p.cover ? (signed.get(p.cover) ?? null) : null }));
}

export async function getPublicReviews(businessId: string) {
  const admin = createAdminClient();
  const [{ data }, { count }] = await Promise.all([
    admin.from("reviews").select("id, author_name, rating, comment, reply, replied_at, created_at").eq("business_id", businessId).eq("status", "published").order("created_at", { ascending: false }).limit(50),
    admin.from("reviews").select("id", { count: "exact", head: true }).eq("business_id", businessId).eq("status", "published"),
  ]);
  const { data: all } = await admin.from("reviews").select("rating").eq("business_id", businessId).eq("status", "published").limit(5000);
  return { reviews: data ?? [], total: count ?? 0, ratings: (all ?? []).map((r) => r.rating as number) };
}

/** Empreinte de l'adresse IP du visiteur (jamais stockée en clair). */
export async function visitorKey(scope: string) {
  const h = await headers();
  const ip = (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || h.get("x-real-ip") || "inconnue";
  const salt = process.env.SUPABASE_SERVICE_ROLE_KEY?.slice(-16) ?? "publia";
  return `${scope}:${createHash("sha256").update(`${salt}:${ip}`).digest("hex").slice(0, 32)}`;
}

/** Limite publique (formulaires) : vrai si autorisé. */
export async function publicRateLimit(key: string, limit: number, windowSeconds: number) {
  const { data, error } = await createAdminClient().rpc("public_rate_limit_hit", { p_key: key, p_limit: limit, p_window_seconds: windowSeconds });
  return error ? false : data === true;
}
