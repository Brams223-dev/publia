import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Category } from "./config";

/** Catégories actives, triées (référentiel en base, enrichissable sans déploiement). */
export async function getCategories(supabase: SupabaseClient): Promise<Category[]> {
  const { data } = await supabase
    .from("product_categories")
    .select("id, name, attribute_schema, sale_types, regulated, sort_order")
    .eq("active", true)
    .order("sort_order");
  return (data ?? []) as Category[];
}

/** URL signées des médias (bucket privé « uploads »). */
export async function signPaths(supabase: SupabaseClient, paths: string[], ttl = 3600) {
  const map = new Map<string, string>();
  if (!paths.length) return map;
  const { data } = await supabase.storage.from("uploads").createSignedUrls(paths, ttl);
  for (const d of data ?? []) if (d.path && d.signedUrl) map.set(d.path, d.signedUrl);
  return map;
}
