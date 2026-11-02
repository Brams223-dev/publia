import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Clock, Globe, MapPin, Phone, Star } from "lucide-react";
import { getPublicProducts, getPublicReviews, getPublicSite } from "@/lib/public-site";
import { averageRating } from "@/lib/minisite";
import { formatInstant, formatMoney } from "@/lib/format";
import { getMarket } from "@/config/markets";
import { ContactForm } from "./contact-form";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const site = await getPublicSite((await params).slug);
  if (!site) return { title: "Page introuvable" };
  const desc = (site.settings.headline || site.description || `${site.category ?? "Commerce"}${site.city ? ` à ${site.city}` : ""}`).slice(0, 160);
  return { title: site.name, description: desc, openGraph: { title: site.name, description: desc } };
}

const Stars = ({ value }: { value: number }) => (
  <span className="text-amber-500" aria-label={`${value} sur 5`}>
    {"★".repeat(Math.round(value))}
    <span className="text-neutral-300">{"★".repeat(5 - Math.round(value))}</span>
  </span>
);

export default async function PublicSitePage({ params }: Props) {
  const { slug } = await params;
  const site = await getPublicSite(slug);
  if (!site) notFound();
  const s = site.settings;
  const market = getMarket(site.countryCode);
  const [products, reviewData] = await Promise.all([
    s.show_catalogue ? getPublicProducts(site.businessId) : Promise.resolve([]),
    s.show_reviews ? getPublicReviews(site.businessId) : Promise.resolve({ reviews: [], total: 0, ratings: [] as number[] }),
  ]);
  const avg = averageRating(reviewData.ratings);
  const mapsUrl = site.address || site.city ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([site.name, site.address, site.city].filter(Boolean).join(", "))}` : null;
  const socials = Object.entries(site.socialLinks).filter(([, v]) => v);
  const style = { "--site-primary": site.colors.primary, "--site-text": site.colors.text } as React.CSSProperties;

  // Données structurées pour les moteurs de recherche (commerce local).
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: site.name,
    description: site.description ?? undefined,
    telephone: s.show_phone ? site.phone ?? undefined : undefined,
    address: s.show_address && (site.address || site.city) ? { "@type": "PostalAddress", streetAddress: site.address ?? undefined, addressLocality: site.city ?? undefined, addressCountry: site.countryCode } : undefined,
    url: site.website ?? undefined,
    aggregateRating: avg ? { "@type": "AggregateRating", ratingValue: avg, reviewCount: reviewData.total } : undefined,
  };

  return (
    <div style={style} className="min-h-dvh bg-canvas text-ink">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <header className="text-white" style={{ background: "var(--site-primary)" }}>
        <div className="mx-auto flex max-w-4xl flex-col items-center gap-3 px-4 py-12 text-center">
          {site.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={site.logoUrl} alt={`Logo ${site.name}`} className="size-20 rounded-2xl bg-white object-contain p-2" />
          ) : null}
          <h1 className="text-3xl font-semibold sm:text-4xl">{site.name}</h1>
          {s.headline ? <p className="max-w-xl text-lg text-white/90">{s.headline}</p> : null}
          <p className="text-sm text-white/80">{[site.category, site.city].filter(Boolean).join(" · ")}</p>
          {avg ? (
            <a href="#avis" className="rounded-full bg-white/15 px-3 py-1 text-sm">★ {avg.toLocaleString(market.intlLocale)} / 5 · {reviewData.total} avis</a>
          ) : null}
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-8 px-4 py-10">
        <section className="grid gap-4 sm:grid-cols-2">
          <div className="card space-y-3 p-5">
            <h2 className="font-semibold">À propos</h2>
            <p className="whitespace-pre-line text-sm text-ink-soft">{s.about || site.description || "—"}</p>
            {socials.length ? (
              <p className="flex flex-wrap gap-2 text-sm">
                {socials.map(([k, v]) => (
                  <a key={k} href={v.startsWith("http") ? v : `https://${v}`} target="_blank" rel="noopener noreferrer nofollow" className="rounded-full bg-canvas px-3 py-1 capitalize hover:underline">{k}</a>
                ))}
              </p>
            ) : null}
          </div>
          <div className="card space-y-3 p-5 text-sm">
            <h2 className="font-semibold">Infos pratiques</h2>
            {s.show_address && (site.address || site.city) ? (
              <p className="flex gap-2"><MapPin className="mt-0.5 size-4 shrink-0" style={{ color: "var(--site-primary)" }} />
                <span>{[site.address, site.city].filter(Boolean).join(", ")}{mapsUrl ? <> · <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="underline">Itinéraire</a></> : null}</span>
              </p>
            ) : null}
            {s.show_phone && site.phone ? (
              <p className="flex gap-2"><Phone className="mt-0.5 size-4 shrink-0" style={{ color: "var(--site-primary)" }} /><a href={`tel:${site.phone.replace(/\s/g, "")}`} className="underline">{site.phone}</a></p>
            ) : null}
            {s.show_hours && site.openingHours ? (
              <p className="flex gap-2"><Clock className="mt-0.5 size-4 shrink-0" style={{ color: "var(--site-primary)" }} /><span className="whitespace-pre-line">{site.openingHours}</span></p>
            ) : null}
            {site.website ? (
              <p className="flex gap-2"><Globe className="mt-0.5 size-4 shrink-0" style={{ color: "var(--site-primary)" }} /><a href={site.website} target="_blank" rel="noopener noreferrer" className="truncate underline">{site.website.replace(/^https?:\/\//, "")}</a></p>
            ) : null}
          </div>
        </section>

        {s.show_catalogue && products.length ? (
          <section className="space-y-4">
            <h2 className="text-xl font-semibold">Nos produits et services</h2>
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {products.map((p) => (
                <li key={p.id} className="card overflow-hidden">
                  {p.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.imageUrl} alt={p.name} className="aspect-square w-full object-cover" loading="lazy" />
                  ) : null}
                  <div className="space-y-1 p-4">
                    <p className="font-medium">{p.name}</p>
                    {p.description ? <p className="line-clamp-2 text-sm text-ink-soft">{p.description}</p> : null}
                    <p className="flex items-baseline gap-2">
                      <span className="font-semibold">{formatMoney(p.price_cents, market)}</span>
                      {p.compare_at_cents ? <span className="text-sm text-ink-soft line-through">{formatMoney(p.compare_at_cents, market)}</span> : null}
                    </p>
                    {p.stock_policy === "tracked" && !p.has_variants && p.stock_quantity === 0 ? <p className="text-xs text-danger">Rupture de stock</p> : null}
                    {p.stock_policy === "preorder" ? <p className="text-xs text-ink-soft">En précommande</p> : null}
                    {p.stock_policy === "on_order" ? <p className="text-xs text-ink-soft">Disponible sur commande</p> : null}
                  </div>
                </li>
              ))}
            </ul>
            <p className="text-xs text-ink-soft">Prix TTC. Pour commander ou réserver, contactez-nous ci-dessous. La commande en ligne arrive bientôt.</p>
          </section>
        ) : null}

        {s.show_reviews ? (
          <section id="avis" className="space-y-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <h2 className="text-xl font-semibold">Avis clients</h2>
              <Link href={`/b/${site.slug}/avis`} className="btn-primary" style={{ background: "var(--site-primary)" }}><Star className="size-4" /> Donner mon avis</Link>
            </div>
            {reviewData.reviews.length ? (
              <ul className="space-y-3">
                {reviewData.reviews.map((r) => (
                  <li key={r.id} className="card space-y-2 p-4 text-sm">
                    <p className="flex flex-wrap items-center gap-2"><Stars value={r.rating} /> <span className="font-medium">{r.author_name}</span> <span className="text-ink-soft">· {formatInstant(r.created_at, "dayMonthYear", market)}</span></p>
                    {r.comment ? <p className="whitespace-pre-line">{r.comment}</p> : null}
                    {r.reply ? <p className="rounded-xl bg-canvas p-3 text-ink-soft"><span className="font-medium text-ink">Réponse de {site.name} : </span>{r.reply}</p> : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-ink-soft">Aucun avis publié pour le moment. Soyez le premier !</p>
            )}
            <p className="text-xs text-ink-soft">
              Avis déposés par des visiteurs sur cette page, sans vérification d&apos;achat. Ils sont publiés après un contrôle qui écarte
              uniquement les contenus illicites, injurieux ou sans rapport avec le commerce, quelle que soit la note. Avis affichés du plus récent au plus ancien.
            </p>
          </section>
        ) : null}

        {s.show_contact_form ? (
          <section className="card space-y-4 p-5">
            <h2 className="text-xl font-semibold">Nous écrire</h2>
            <ContactForm slug={site.slug} businessName={site.name} />
          </section>
        ) : null}
      </main>

      <footer className="border-t border-line py-6 text-center text-xs text-ink-soft">
        © {site.name} · Site créé avec <Link href="/" className="underline">Publia</Link>
      </footer>
    </div>
  );
}
