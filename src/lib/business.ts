import "server-only";
import { cookies } from "next/headers";
import { getUser } from "@/lib/supabase/server";
import { DEFAULT_COLORS, type BrandColors } from "@/lib/config/business";

export type SocialLinks = Partial<Record<"instagram" | "facebook" | "tiktok" | "youtube", string>>;
export type OrgRole = "owner" | "admin" | "member";

export type Business = {
  id: string;
  organization_id: string;
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

export type BusinessSummary = { id: string; name: string; organization_id: string; organization_name: string; role: OrgRole };

/** Cookie du commerce actif (identifiant uniquement ; l'accès est toujours vérifié par la RLS). */
export const CURRENT_BUSINESS_COOKIE = "publia_commerce";

const COLUMNS =
  "id, organization_id, name, category, description, address, city, phone, website, tone, brand_colors, logo_url, products, services, target_audience, opening_hours, social_links, goals, country_code, locale, currency, timezone";

export const ROLE_LABELS: Record<OrgRole, string> = { owner: "Propriétaire", admin: "Administrateur", member: "Employé" };

/** Rôles autorisés à modifier les réglages d'un commerce et à gérer l'équipe. */
export const canManage = (role: OrgRole | null | undefined) => role === "owner" || role === "admin";

/**
 * Commerce actif de l'utilisateur connecté, parmi ceux de ses organisations.
 * Choix mémorisé dans un cookie ; à défaut, le plus ancien commerce accessible.
 */
export async function getCurrentBusiness() {
  const { supabase, user } = await getUser();
  const empty = { supabase, user, business: null as Business | null, role: null as OrgRole | null, businesses: [] as BusinessSummary[] };
  if (!user) return empty;

  const [{ data: memberships }, { data: list }] = await Promise.all([
    supabase.from("organization_members").select("organization_id, role, organizations(name)").eq("user_id", user.id),
    supabase.from("businesses").select("id, name, organization_id").order("created_at"),
  ]);
  const roles = new Map((memberships ?? []).map((m) => [m.organization_id, m]));
  const businesses: BusinessSummary[] = (list ?? [])
    .filter((b) => roles.has(b.organization_id))
    .map((b) => {
      const m = roles.get(b.organization_id)!;
      const org = m.organizations as unknown as { name: string } | null;
      return { id: b.id, name: b.name, organization_id: b.organization_id, organization_name: org?.name ?? "", role: m.role as OrgRole };
    });
  if (!businesses.length) return { ...empty, businesses };

  const wanted = (await cookies()).get(CURRENT_BUSINESS_COOKIE)?.value;
  const current = businesses.find((b) => b.id === wanted) ?? businesses[0];

  const { data } = await supabase.from("businesses").select(COLUMNS).eq("id", current.id).maybeSingle();
  const business = data
    ? ({
        ...data,
        brand_colors: { ...DEFAULT_COLORS, ...(data.brand_colors ?? {}) },
        social_links: (data.social_links ?? {}) as SocialLinks,
      } as Business)
    : null;
  return { supabase, user, business, role: current.role, businesses };
}

/** Taux de complétude du profil, pour guider le commerçant. */
export function profileCompleteness(b: Business | null) {
  if (!b) return 0;
  const fields = [b.name, b.category, b.description, b.city, b.tone, b.products || b.services, b.target_audience, b.logo_url];
  return Math.round((fields.filter(Boolean).length / fields.length) * 100);
}
