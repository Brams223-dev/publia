import type { Metadata } from "next";
import Link from "next/link";
import { ExternalLink, Globe } from "lucide-react";
import { canManage, getCurrentBusiness } from "@/lib/business";
import { isSupabaseConfigured, SITE_URL } from "@/lib/supabase/env";
import { readSettings, slugify } from "@/lib/minisite";
import { MiniSiteForm } from "./mini-site-form";

export const metadata: Metadata = { title: "Mini-site" };

export default async function MiniSitePage() {
  if (!isSupabaseConfigured()) return null;
  const { supabase, business, role } = await getCurrentBusiness();
  if (!business)
    return (
      <div className="mt-4 card p-6">
        <p className="font-semibold">Présentez d&apos;abord votre commerce</p>
        <Link href="/mon-commerce" className="btn-primary mt-4">Renseigner mon commerce</Link>
      </div>
    );
  const [{ data: shop }, { count: products }, { count: reviews }] = await Promise.all([
    supabase.from("shops").select("slug, name, published, settings").eq("business_id", business.id).maybeSingle(),
    supabase.from("products").select("id", { count: "exact", head: true }).eq("business_id", business.id).eq("status", "active"),
    supabase.from("reviews").select("id", { count: "exact", head: true }).eq("business_id", business.id).eq("status", "published"),
  ]);
  const slug = shop?.slug ?? slugify(`${business.name}${business.city ? `-${business.city}` : ""}`);
  const url = `${SITE_URL}/b/${slug}`;

  return (
    <div className="mt-4 space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex items-start gap-4">
          <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-brand text-white"><Globe className="size-6" /></span>
          <div>
            <h1 className="text-2xl font-semibold sm:text-3xl">Mini-site</h1>
            <p className="mt-1 text-ink-soft">Une page publique pour votre commerce : infos, horaires, produits, avis et formulaire de contact.</p>
          </div>
        </div>
        {shop?.published ? (
          <a href={url} target="_blank" rel="noopener noreferrer" className="btn-ghost"><ExternalLink className="size-4" /> Voir mon mini-site</a>
        ) : null}
      </header>

      <p className="rounded-2xl border border-line bg-white px-4 py-3 text-sm text-ink-soft">
        Le contenu vient de « Mon commerce » (nom, description, adresse, horaires, logo, couleurs) et de votre catalogue
        ({products ?? 0} produit(s) actif(s)). {reviews ?? 0} avis publié(s). Les messages reçus arrivent dans l&apos;Inbox.
      </p>

      <MiniSiteForm
        disabled={!canManage(role)}
        siteUrlPrefix={`${SITE_URL}/b/`}
        values={{ slug, name: shop?.name ?? "", published: shop?.published ?? false, settings: readSettings(shop?.settings) }}
      />
    </div>
  );
}
