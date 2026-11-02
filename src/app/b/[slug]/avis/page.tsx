import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPublicSite } from "@/lib/public-site";
import { ReviewForm } from "./review-form";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const site = await getPublicSite((await params).slug);
  return { title: site ? `Donner mon avis · ${site.name}` : "Page introuvable", robots: { index: false } };
}

export default async function ReviewPage({ params }: Props) {
  const site = await getPublicSite((await params).slug);
  if (!site || !site.settings.show_reviews) notFound();
  return (
    <div className="min-h-dvh bg-canvas px-4 py-10" style={{ "--site-primary": site.colors.primary } as React.CSSProperties}>
      <div className="mx-auto max-w-lg space-y-5">
        <Link href={`/b/${site.slug}`} className="text-sm text-ink-soft hover:underline">← {site.name}</Link>
        <div className="card space-y-4 p-6">
          <h1 className="text-2xl font-semibold">Votre avis sur {site.name}</h1>
          <ReviewForm slug={site.slug} googleUrl={site.settings.google_review_url || null} />
        </div>
        <p className="text-xs text-ink-soft">
          Votre avis est publié après un contrôle qui écarte uniquement les contenus illicites, injurieux ou sans rapport avec le
          commerce, quelle que soit la note. Le commerce peut y répondre publiquement. Votre e-mail, facultatif, n&apos;est pas publié.
        </p>
      </div>
    </div>
  );
}
