import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentBusiness } from "@/lib/business";
import { getQuota } from "@/lib/quota";
import { isAIConfigured } from "@/lib/ai";
import { isAdminConfigured } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { getCategories } from "@/lib/commerce/catalog";
import { templateById } from "@/lib/commerce/config";
import { NewProduct } from "./new-product";

export const metadata: Metadata = { title: "Nouveau produit" };
export const maxDuration = 120;

export default async function NewProductPage({ searchParams }: { searchParams: Promise<{ mode?: string }> }) {
  if (!isSupabaseConfigured()) return null;
  const { mode } = await searchParams;
  const { supabase, user, business } = await getCurrentBusiness();
  if (!user) return null;
  if (!business)
    return (
      <div className="mt-4 card p-6">
        <p className="font-semibold">Présentez d&apos;abord votre commerce</p>
        <Link href="/mon-commerce" className="btn-primary mt-4">Renseigner mon commerce</Link>
      </div>
    );

  const [quota, categories, { data: shop }] = await Promise.all([
    getQuota(supabase, business?.id),
    getCategories(supabase),
    supabase.from("shops").select("template").eq("business_id", business.id).maybeSingle(),
  ]);
  const template = templateById(shop?.template);
  const ordered = template.categories.length
    ? [...template.categories.map((id) => categories.find((c) => c.id === id)!).filter(Boolean), ...categories.filter((c) => !template.categories.includes(c.id))]
    : categories;
  const remaining = Math.max(0, quota.generationsQuota - quota.generationsUsed);
  const aiReady = isAIConfigured() && isAdminConfigured();

  return (
    <div className="mt-4 space-y-6">
      <header>
        <Link href="/catalogue" className="text-sm text-ink-soft hover:text-brand">← Catalogue</Link>
        <h1 className="mt-2 text-2xl font-semibold sm:text-3xl">Nouveau produit</h1>
        <p className="mt-1 text-ink-soft">Produit physique, numérique, sur mesure ou prestation : une seule fiche, adaptée à votre métier.</p>
      </header>
      <NewProduct
        businessId={business.id}
        categories={ordered.map((c) => ({ id: c.id, name: c.name, regulated: c.regulated }))}
        featuredCount={template.categories.length}
        initialMode={mode === "ia" ? "ai" : "manual"}
        aiReady={aiReady}
        remaining={remaining}
      />
    </div>
  );
}
