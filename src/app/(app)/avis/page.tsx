import type { Metadata } from "next";
import Link from "next/link";
import { Star } from "lucide-react";
import { getCurrentBusiness } from "@/lib/business";
import { isSupabaseConfigured, SITE_URL } from "@/lib/supabase/env";
import { averageRating } from "@/lib/minisite";
import { formatInstant, formatNumber } from "@/lib/format";
import { ReviewCard } from "./review-card";
import { CopyLink } from "./copy-link";

export const metadata: Metadata = { title: "Avis clients" };

type SP = Record<string, string | string[] | undefined>;
const TABS = { pending: "À modérer", published: "Publiés", hidden: "Masqués" } as const;

export default async function ReviewsPage({ searchParams }: { searchParams: Promise<SP> }) {
  if (!isSupabaseConfigured()) return null;
  const sp = await searchParams;
  const { supabase, business } = await getCurrentBusiness();
  if (!business)
    return (
      <div className="mt-4 card p-6">
        <p className="font-semibold">Présentez d&apos;abord votre commerce</p>
        <Link href="/mon-commerce" className="btn-primary mt-4">Renseigner mon commerce</Link>
      </div>
    );
  const raw = Array.isArray(sp.tab) ? sp.tab[0] : sp.tab;
  const tab = (raw && raw in TABS ? raw : "pending") as keyof typeof TABS;
  const [{ data: list }, { data: all }, { data: shop }] = await Promise.all([
    supabase.from("reviews").select("id, author_name, rating, comment, status, reply, created_at, contact_id").eq("business_id", business.id).eq("status", tab).order("created_at", { ascending: false }).limit(100),
    supabase.from("reviews").select("rating, status").eq("business_id", business.id).limit(5000),
    supabase.from("shops").select("slug, published, settings").eq("business_id", business.id).maybeSingle(),
  ]);
  const counts = { pending: 0, published: 0, hidden: 0 } as Record<keyof typeof TABS, number>;
  for (const r of all ?? []) counts[r.status as keyof typeof TABS]++;
  const published = (all ?? []).filter((r) => r.status === "published").map((r) => r.rating as number);
  const avg = averageRating(published);
  const reviewsOn = Boolean(shop?.published && shop.slug && (shop.settings as { show_reviews?: boolean } | null)?.show_reviews !== false);
  const link = shop?.slug ? `${SITE_URL}/b/${shop.slug}/avis` : null;
  const distribution = [5, 4, 3, 2, 1].map((n) => ({ n, count: published.filter((r) => r === n).length }));

  return (
    <div className="mt-4 space-y-6">
      <header className="flex items-start gap-4">
        <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-brand text-white"><Star className="size-6" /></span>
        <div>
          <h1 className="text-2xl font-semibold sm:text-3xl">Avis clients</h1>
          <p className="mt-1 text-ink-soft">Collectez des avis authentiques, répondez-y et affichez-les sur votre mini-site.</p>
        </div>
      </header>

      <section className="grid gap-3 sm:grid-cols-[14rem_minmax(0,1fr)]">
        <div className="card p-4">
          <p className="text-sm text-ink-soft">Note moyenne publiée</p>
          <p className="mt-1 text-3xl font-semibold">{avg ? `${avg.toLocaleString("fr-FR")} / 5` : "—"}</p>
          <p className="text-sm text-ink-soft">{formatNumber(published.length)} avis publiés</p>
        </div>
        <div className="card space-y-1.5 p-4">
          {distribution.map((d) => (
            <div key={d.n} className="flex items-center gap-2 text-sm">
              <span className="w-8 shrink-0">{d.n} ★</span>
              <span className="h-2 flex-1 overflow-hidden rounded-full bg-canvas">
                <span className="block h-full rounded-full bg-amber-400" style={{ width: `${published.length ? (d.count / published.length) * 100 : 0}%` }} />
              </span>
              <span className="w-8 shrink-0 text-right text-ink-soft">{d.count}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="card space-y-2 p-5">
        <h2 className="font-semibold">Votre lien pour recueillir des avis</h2>
        {reviewsOn && link ? (
          <>
            <CopyLink url={link} />
            <p className="text-sm text-ink-soft">
              Envoyez-le à vos clients (SMS, e-mail, QR code en caisse). Demandez un avis à tous vos clients, sans le réserver à ceux qui
              sont satisfaits et sans contrepartie : c&apos;est la règle légale, et c&apos;est ce qui rend vos avis crédibles.
            </p>
          </>
        ) : (
          <p className="text-sm text-ink-soft">
            Publiez votre <Link href="/mini-site" className="font-medium text-brand hover:underline">mini-site</Link> avec la section avis activée pour obtenir votre lien.
          </p>
        )}
      </section>

      <nav className="flex flex-wrap gap-2 text-sm">
        {(Object.keys(TABS) as (keyof typeof TABS)[]).map((k) => (
          <Link key={k} href={`/avis?tab=${k}`} className={`rounded-full px-4 py-2 font-medium ${tab === k ? "bg-brand text-white" : "border border-line bg-white text-ink-soft hover:text-brand"}`}>
            {TABS[k]} ({counts[k]})
          </Link>
        ))}
      </nav>

      {tab === "pending" && counts.pending ? (
        <p className="text-sm text-ink-soft">
          Publiez tous les avis authentiques, y compris négatifs. Ne masquez un avis que s&apos;il est injurieux, illicite, sans rapport
          avec votre commerce ou manifestement faux : chaque décision est enregistrée dans le journal d&apos;activité.
        </p>
      ) : null}

      {(list ?? []).length ? (
        <ul className="space-y-3">
          {(list ?? []).map((r) => (
            <ReviewCard key={r.id} review={{ ...r, when: formatInstant(r.created_at, "full") }} />
          ))}
        </ul>
      ) : (
        <div className="card p-8 text-center text-sm text-ink-soft">Aucun avis dans cette rubrique.</div>
      )}
    </div>
  );
}
