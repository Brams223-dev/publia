import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Check, ExternalLink, MapPin } from "lucide-react";
import { canManage, getCurrentBusiness } from "@/lib/business";
import { isSupabaseConfigured, SITE_URL } from "@/lib/supabase/env";
import { computeVisibility, napBlock } from "@/lib/local-visibility";
import { readSettings } from "@/lib/minisite";
import { DeclaredCheck, CopyBlock } from "./client";

export const metadata: Metadata = { title: "Visibilité locale" };

const GROUPS = { profil: "Profil du commerce", site: "Mini-site et catalogue", avis: "Avis clients", google: "Fiche Google (déclaré par vous)" } as const;
const DIRECTORIES = [
  { name: "Google Business Profile", url: "https://business.google.com", why: "Google Maps et la recherche Google" },
  { name: "Apple Business Connect", url: "https://businessconnect.apple.com", why: "Plans sur iPhone et Siri" },
  { name: "Bing Places", url: "https://www.bingplaces.com", why: "Bing et certains GPS" },
  { name: "PagesJaunes", url: "https://www.pagesjaunes.fr", why: "Annuaire de référence en France" },
];

/** Date ISO il y a N jours (calcul côté serveur, à chaque requête). */
function daysAgoIso(days: number) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString();
}

export default async function LocalVisibilityPage() {
  if (!isSupabaseConfigured()) return null;
  const { supabase, business, role } = await getCurrentBusiness();
  if (!business)
    return (
      <div className="mt-4 card p-6">
        <p className="font-semibold">Présentez d&apos;abord votre commerce</p>
        <Link href="/mon-commerce" className="btn-primary mt-4">Renseigner mon commerce</Link>
      </div>
    );
  const since = daysAgoIso(90);
  const [{ data: shop }, { count: photos }, { count: products }, { count: reviews }, { count: recent }, { count: replied }] = await Promise.all([
    supabase.from("shops").select("slug, published, settings").eq("business_id", business.id).maybeSingle(),
    supabase.from("brand_assets").select("id", { count: "exact", head: true }).eq("business_id", business.id).eq("asset_type", "photo"),
    supabase.from("products").select("id", { count: "exact", head: true }).eq("business_id", business.id).eq("status", "active"),
    supabase.from("reviews").select("id", { count: "exact", head: true }).eq("business_id", business.id).eq("status", "published"),
    supabase.from("reviews").select("id", { count: "exact", head: true }).eq("business_id", business.id).eq("status", "published").gte("created_at", since),
    supabase.from("reviews").select("id", { count: "exact", head: true }).eq("business_id", business.id).eq("status", "published").not("reply", "is", null),
  ]);
  const settings = (shop?.settings as Record<string, unknown>) ?? {};
  const declared = (settings.visibility_checklist as Record<string, boolean>) ?? {};
  const siteUrl = shop?.published && shop.slug ? `${SITE_URL}/b/${shop.slug}` : null;
  const result = computeVisibility({
    business,
    photos: photos ?? 0,
    minisitePublished: Boolean(shop?.published),
    minisiteShowsAddress: readSettings(settings).show_address,
    activeProducts: products ?? 0,
    publishedReviews: reviews ?? 0,
    recentReviews: recent ?? 0,
    repliedReviews: replied ?? 0,
    declared,
  });
  const manage = canManage(role);
  const ring = `conic-gradient(var(--color-brand) ${result.score * 3.6}deg, var(--color-brand-soft) 0)`;

  return (
    <div className="mt-4 space-y-6">
      <header className="flex items-start gap-4">
        <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-brand text-white"><MapPin className="size-6" /></span>
        <div>
          <h1 className="text-2xl font-semibold sm:text-3xl">Visibilité locale</h1>
          <p className="mt-1 text-ink-soft">Ce qui aide les clients du quartier à vous trouver, calculé à partir de vos informations réelles.</p>
        </div>
      </header>

      <section className="card flex flex-wrap items-center gap-6 p-5">
        <div className="grid size-28 shrink-0 place-items-center rounded-full" style={{ background: ring }} role="img" aria-label={`Score ${result.score} sur 100`}>
          <div className="grid size-22 place-items-center rounded-full bg-white">
            <span className="text-2xl font-semibold">{result.score}<span className="text-sm text-ink-soft">/100</span></span>
          </div>
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <p className="text-lg font-semibold">Visibilité {result.level.toLowerCase()}</p>
          {result.priorities.length ? (
            <>
              <p className="text-sm text-ink-soft">Vos 3 actions prioritaires :</p>
              <ol className="list-decimal space-y-1 pl-5 text-sm">
                {result.priorities.map((p) => (
                  <li key={p.id}>{p.href ? <Link href={p.href} className="font-medium text-brand hover:underline">{p.label}</Link> : <span className="font-medium">{p.label}</span>} — {p.advice}</li>
                ))}
              </ol>
            </>
          ) : (
            <p className="text-sm text-ink-soft">Tout est en place. Continuez à demander des avis et à publier régulièrement.</p>
          )}
          <p className="text-xs text-ink-soft">Ce score est un guide Publia, pas une mesure de Google : il indique les bonnes pratiques couvertes.</p>
        </div>
      </section>

      {(Object.keys(GROUPS) as (keyof typeof GROUPS)[]).map((g) => (
        <section key={g} className="card space-y-3 p-5">
          <h2 className="font-semibold">{GROUPS[g]}</h2>
          {g === "google" ? <p className="text-sm text-ink-soft">Publia n&apos;est pas connecté à Google : cochez ce que vous avez fait sur votre fiche. Ces points comptent dans le score sur votre déclaration.</p> : null}
          <ul className="divide-y divide-line">
            {result.checks.filter((c) => c.group === g).map((c) => (
              <li key={c.id} className="flex items-start gap-3 py-2.5 text-sm">
                {c.declared ? (
                  <DeclaredCheck id={c.id} done={c.done} disabled={!manage} />
                ) : (
                  <span className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-full ${c.done ? "bg-success text-white" : "border border-line"}`}>{c.done ? <Check className="size-3.5" /> : null}</span>
                )}
                <span className="min-w-0 flex-1">
                  <span className={c.done ? "" : "font-medium"}>{c.label}</span>
                  {!c.done ? <span className="block text-ink-soft">{c.advice}</span> : null}
                </span>
                {!c.done && c.href ? <Link href={c.href} className="shrink-0 text-brand hover:underline" aria-label={`Corriger : ${c.label}`}><ArrowRight className="size-4" /></Link> : null}
                <span className="w-10 shrink-0 text-right text-xs text-ink-soft">{c.points} pts</span>
              </li>
            ))}
          </ul>
        </section>
      ))}

      <section className="card space-y-3 p-5">
        <h2 className="font-semibold">Vos coordonnées, identiques partout</h2>
        <p className="text-sm text-ink-soft">Recopiez exactement ce bloc sur chaque annuaire. Des différences (abréviations, ancien numéro) brouillent les moteurs de recherche.</p>
        <CopyBlock text={napBlock(business, siteUrl)} />
        <ul className="grid gap-2 sm:grid-cols-2">
          {DIRECTORIES.map((d) => (
            <li key={d.name}>
              <a href={d.url} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between gap-2 rounded-xl border border-line p-3 text-sm hover:border-brand-light">
                <span><span className="font-medium">{d.name}</span><span className="block text-xs text-ink-soft">{d.why}</span></span>
                <ExternalLink className="size-4 shrink-0 text-ink-soft" />
              </a>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
