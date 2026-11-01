import type { Metadata } from "next";
import Link from "next/link";
import { Sparkles, Store } from "lucide-react";
import { getCurrentBusiness, profileCompleteness } from "@/lib/business";
import { getQuota } from "@/lib/quota";
import { isAIConfigured } from "@/lib/ai/openai";
import { isAdminConfigured } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { CampaignForm } from "./campaign-form";

export const metadata: Metadata = { title: "Fais ma communication" };
// La génération IA peut prendre jusqu'à ~90 s.
export const maxDuration = 120;

export default async function DoMyMarketingPage() {
  if (!isSupabaseConfigured()) return null;
  const { supabase, user, business } = await getCurrentBusiness();
  if (!user) return null;

  const quota = await getQuota(supabase, user.id);
  const remaining = Math.max(0, quota.generationsQuota - quota.generationsUsed);
  const serverReady = isAIConfigured() && isAdminConfigured();
  const completeness = profileCompleteness(business);

  return (
    <div className="mt-4 space-y-6">
      <header className="flex items-start gap-4">
        <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-brand text-white shadow-[0_8px_20px_rgb(107_85_217/0.35)]">
          <Sparkles className="size-6" />
        </span>
        <div>
          <h1 className="text-2xl font-semibold sm:text-3xl">Fais ma communication</h1>
          <p className="mt-1 text-ink-soft">
            Choisissez un objectif : Publia prépare une campagne complète, prête à relire et à valider.
          </p>
        </div>
      </header>

      {!serverReady && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p className="font-semibold">La génération par IA n&apos;est pas encore activée.</p>
          <p className="mt-1">
            L&apos;administrateur doit ajouter <code className="font-mono">OPENAI_API_KEY</code> et{" "}
            <code className="font-mono">SUPABASE_SERVICE_ROLE_KEY</code> dans les variables Vercel, puis redéployer.
          </p>
        </div>
      )}

      {!business ? (
        <div className="card flex flex-col items-start gap-4 p-6 sm:flex-row sm:items-center">
          <span className="grid size-11 place-items-center rounded-2xl bg-brand-soft text-brand">
            <Store className="size-5" />
          </span>
          <div className="flex-1">
            <p className="font-semibold">Présentez d&apos;abord votre commerce</p>
            <p className="text-sm text-ink-soft">Publia s&apos;appuie sur votre profil pour écrire des contenus justes, sans rien inventer.</p>
          </div>
          <Link href="/mon-commerce" className="btn-primary">Renseigner mon commerce</Link>
        </div>
      ) : (
        <>
          {completeness < 75 && (
            <p className="rounded-2xl border border-line bg-white px-4 py-3 text-sm text-ink-soft">
              Profil complété à {completeness} %. Plus il est précis (produits, public cible, horaires…), plus les contenus seront justes.{" "}
              <Link href="/mon-commerce" className="font-semibold text-brand hover:underline">Compléter</Link>
            </p>
          )}
          {remaining === 0 && (
            <p className="rounded-2xl border border-line bg-white px-4 py-3 text-sm">
              Vous avez utilisé vos {quota.generationsQuota} générations du mois (offre {quota.planName}). Elles se renouvellent le 1er du mois.
            </p>
          )}
          <CampaignForm disabled={!serverReady || remaining === 0} remaining={remaining} />
        </>
      )}
    </div>
  );
}
