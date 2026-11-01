import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentBusiness } from "@/lib/business";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { getCategories, signPaths } from "@/lib/commerce/catalog";
import { formatMoney } from "@/lib/format";
import { getMarket } from "@/config/markets";
import { ProductEditor, type EditorProduct } from "./product-editor";

export const metadata: Metadata = { title: "Fiche produit" };

export default async function ProductPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ia?: string }> }) {
  if (!isSupabaseConfigured()) return null;
  const { id } = await params;
  const { ia } = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { supabase, business } = await getCurrentBusiness();
  if (!business) notFound();

  const { data: p } = await supabase.from("products").select("*").eq("id", id).eq("business_id", business.id).maybeSingle();
  if (!p) notFound();

  const [categories, { data: variants }, { data: media }, { data: collections }, { data: links }, { data: similar }] = await Promise.all([
    getCategories(supabase),
    supabase.from("product_variants").select("options, sku, price_cents, stock_quantity, active").eq("product_id", id).order("sort_order"),
    supabase.from("product_media").select("id, file_path, origin").eq("product_id", id).order("sort_order"),
    supabase.from("collections").select("id, name").eq("business_id", business.id).order("sort_order"),
    supabase.from("collection_products").select("collection_id").eq("product_id", id),
    supabase
      .from("products")
      .select("id, name, price_cents")
      .eq("business_id", business.id)
      .eq("category_id", p.category_id)
      .neq("id", id)
      .neq("status", "archived")
      .order("created_at", { ascending: false })
      .limit(4),
  ]);
  const signed = await signPaths(supabase, (media ?? []).map((m) => m.file_path));
  const market = getMarket(business.country_code);

  const product: EditorProduct = {
    id: p.id,
    name: p.name,
    categoryId: p.category_id,
    saleType: p.sale_type,
    description: p.description ?? "",
    brand: p.brand ?? "",
    sku: p.sku ?? "",
    priceCents: p.price_cents,
    compareAtCents: p.compare_at_cents,
    unit: p.unit,
    stockPolicy: p.stock_policy,
    stockQuantity: p.stock_quantity,
    weightG: p.weight_g,
    dimensions: p.dimensions ?? {},
    attributes: p.attributes ?? {},
    hasVariants: p.has_variants,
    variants: (variants ?? []).map((v) => ({
      options: v.options as Record<string, string>,
      sku: v.sku ?? "",
      priceCents: v.price_cents,
      stockQuantity: v.stock_quantity,
      active: v.active,
    })),
    seo: { title: "", meta_description: "", keywords: [], ...(p.seo ?? {}) },
    status: p.status,
    collectionIds: (links ?? []).map((l) => l.collection_id),
    complianceConfirmed: Boolean(p.compliance?.confirmed),
    aiMeta: p.ai_meta && Object.keys(p.ai_meta).length ? p.ai_meta : null,
  };

  return (
    <div className="mt-4 space-y-6">
      <header>
        <Link href="/catalogue" className="text-sm text-ink-soft hover:text-brand">← Catalogue</Link>
        <h1 className="mt-2 truncate text-2xl font-semibold sm:text-3xl">{p.name}</h1>
      </header>
      <ProductEditor
        businessId={business.id}
        product={product}
        categories={categories}
        media={(media ?? []).map((m) => ({ id: m.id, url: signed.get(m.file_path) ?? null, origin: m.origin }))}
        collections={collections ?? []}
        country={business.country_code}
        currency={market.currency}
        justGenerated={ia === "1"}
        similar={(similar ?? []).map((s) => ({ id: s.id, name: s.name, price: s.price_cents > 0 ? formatMoney(s.price_cents, market) : "—" }))}
      />
    </div>
  );
}
