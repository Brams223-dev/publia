import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentBusiness } from "@/lib/business";
import { getQuota } from "@/lib/quota";
import { isAIConfigured } from "@/lib/ai/openai";
import { isAdminConfigured } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { AdWizard, type WizardCreation } from "./ad-wizard";

export const metadata: Metadata = { title: "Nouvelle publicité" };
export const maxDuration = 120;

export default async function NewAdPage({ searchParams }: { searchParams: Promise<{ creation?: string }> }) {
  if (!isSupabaseConfigured()) return null;
  const { creation } = await searchParams;
  const { supabase, user, business } = await getCurrentBusiness();
  if (!user) return null;
  if (!business)
    return (
      <div className="mt-4 card p-6">
        <p className="font-semibold">Présentez d&apos;abord votre commerce</p>
        <Link href="/mon-commerce" className="btn-primary mt-4">Renseigner mon commerce</Link>
      </div>
    );

  const [quota, { data: rows }] = await Promise.all([
    getQuota(supabase, user.id),
    supabase.from("creations").select("id, title, file_path").eq("business_id", business.id).order("created_at", { ascending: false }).limit(24),
  ]);
  let creations: WizardCreation[] = [];
  if (rows?.length) {
    const { data: signed } = await supabase.storage.from("uploads").createSignedUrls(rows.map((r) => r.file_path), 3600);
    creations = rows.map((r, i) => ({ id: r.id, title: r.title, url: signed?.[i]?.signedUrl ?? null }));
  }
  const remaining = Math.max(0, quota.generationsQuota - quota.generationsUsed);
  const ready = isAIConfigured() && isAdminConfigured();

  return (
    <div className="mt-4 space-y-6">
      <header>
        <Link href="/ads" className="text-sm text-ink-soft hover:text-brand">← Publia Ads</Link>
        <h1 className="mt-2 text-2xl font-semibold sm:text-3xl">Nouvelle campagne publicitaire</h1>
        <p className="mt-1 text-ink-soft">Décrivez votre objectif : Publia prépare les créations et le ciblage, en brouillon.</p>
      </header>
      {!ready && (
        <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          La génération par IA n&apos;est pas encore activée (clés serveur à configurer).
        </p>
      )}
      <AdWizard
        creations={creations}
        defaultCity={business.city ?? ""}
        defaultUrl={business.website ?? ""}
        disabled={!ready || remaining === 0}
        remaining={remaining}
        preselectedCreation={creation && creations.some((c) => c.id === creation) ? creation : null}
      />
    </div>
  );
}
