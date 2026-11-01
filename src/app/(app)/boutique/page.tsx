import type { Metadata } from "next";
import Link from "next/link";
import { ShoppingBag } from "lucide-react";
import { getCurrentBusiness } from "@/lib/business";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { getCategories } from "@/lib/commerce/catalog";
import { SHOP_TEMPLATES, templateById } from "@/lib/commerce/config";
import { ShopForm } from "./shop-form";

export const metadata: Metadata = { title: "Boutique en ligne" };

export default async function ShopPage() {
  if (!isSupabaseConfigured()) return null;
  const { supabase, business } = await getCurrentBusiness();
  if (!business)
    return (
      <div className="mt-4 card p-6">
        <p className="font-semibold">Présentez d&apos;abord votre commerce</p>
        <Link href="/mon-commerce" className="btn-primary mt-4">Renseigner mon commerce</Link>
      </div>
    );

  const [{ data: shop }, categories] = await Promise.all([
    supabase.from("shops").select("template, name").eq("business_id", business.id).maybeSingle(),
    getCategories(supabase),
  ]);
  const names = Object.fromEntries(categories.map((c) => [c.id, c.name]));
  const labels = Object.fromEntries(categories.flatMap((c) => c.attribute_schema.map((a) => [a.key, a.label])));

  return (
    <div className="mt-4 space-y-6">
      <header className="flex items-start gap-4">
        <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-brand text-white"><ShoppingBag className="size-6" /></span>
        <div>
          <h1 className="text-2xl font-semibold sm:text-3xl">Boutique en ligne</h1>
          <p className="mt-1 text-ink-soft">Choisissez le modèle adapté à votre métier : il organise vos catégories, vos filtres et vos fiches produits.</p>
        </div>
      </header>

      <p className="rounded-2xl border border-line bg-white px-4 py-3 text-sm text-ink-soft">
        <span className="font-semibold text-ink">Version actuelle : </span>catalogue, modèle de boutique et fiches produits. La vitrine
        publique, le panier et le paiement en ligne arrivent dans une prochaine étape : votre boutique n&apos;est pas encore visible par
        vos clients.
      </p>

      <ShopForm
        current={templateById(shop?.template).id}
        name={shop?.name ?? business.name}
        templates={SHOP_TEMPLATES.map((t) => ({
          ...t,
          categoryNames: t.categories.map((c) => names[c]).filter(Boolean),
          filterNames: Array.from(new Set(t.filters.map((f) => labels[f] ?? f))),
        }))}
      />
    </div>
  );
}
