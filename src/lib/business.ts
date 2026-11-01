import "server-only";
import { getUser } from "@/lib/supabase/server";
import { DEFAULT_COLORS, type BrandColors } from "@/lib/config/business";

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
};

/** Commerce principal de l'utilisateur connecté (V1 : un commerce par compte). */
export async function getCurrentBusiness() {
  const { supabase, user } = await getUser();
  if (!user) return { supabase, user, business: null as Business | null };
  const { data } = await supabase
    .from("businesses")
    .select("id, name, category, description, address, city, phone, website, tone, brand_colors, logo_url")
    .eq("owner_id", user.id)
    .order("created_at")
    .limit(1)
    .maybeSingle();
  const business = data
    ? ({ ...data, brand_colors: { ...DEFAULT_COLORS, ...(data.brand_colors ?? {}) } } as Business)
    : null;
  return { supabase, user, business };
}
