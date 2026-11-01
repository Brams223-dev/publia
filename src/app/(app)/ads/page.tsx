import type { Metadata } from "next";
import Link from "next/link";
import { Megaphone, Plus } from "lucide-react";
import { getCurrentBusiness } from "@/lib/business";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { AD_OBJECTIVES, AD_PLATFORMS, AD_STATUS, platformById, type AdObjective } from "@/lib/ads/config";
import { daysBetween, euros } from "@/lib/ads/budget";

export const metadata: Metadata = { title: "Publia Ads" };

export default async function AdsPage() {
  if (!isSupabaseConfigured()) return null;
  const { supabase, business } = await getCurrentBusiness();
  if (!business)
    return (
      <div className="mt-4 card p-6">
        <p className="font-semibold">Présentez d&apos;abord votre commerce</p>
        <Link href="/mon-commerce" className="btn-primary mt-4">Renseigner mon commerce</Link>
      </div>
    );

  const { data: campaigns } = await supabase
    .from("ad_campaigns")
    .select("id, name, platform, objective, status, daily_budget_cents, start_date, end_date")
    .eq("business_id", business.id)
    .order("created_at", { ascending: false })
    .limit(50);

  const list = campaigns ?? [];
  const count = (s: string[]) => list.filter((c) => s.includes(c.status)).length;

  return (
    <div className="mt-4 space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex items-start gap-4">
          <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-brand text-white"><Megaphone className="size-6" /></span>
          <div>
            <h1 className="text-2xl font-semibold sm:text-3xl">Publia Ads</h1>
            <p className="mt-1 text-ink-soft">Créez vos publicités Facebook, Instagram, TikTok, Google et YouTube avec l&apos;IA.</p>
          </div>
        </div>
        <Link href="/ads/nouvelle" className="btn-primary"><Plus className="size-4" /> Nouvelle campagne</Link>
      </header>

      <p className="rounded-2xl border border-line bg-white px-4 py-3 text-sm text-ink-soft">
        <span className="font-semibold text-ink">Version actuelle : </span>création de campagnes en brouillon, créations IA et
        prévisualisation. Aucun compte publicitaire n&apos;est connecté : rien n&apos;est diffusé ni facturé. Les statistiques
        s&apos;afficheront uniquement à partir des données réelles des régies.
      </p>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          ["Brouillons", count(["draft", "ready"])],
          ["Actives", count(["active"])],
          ["En pause", count(["paused"])],
          ["Budget consommé", "—"],
        ].map(([k, v]) => (
          <div key={k as string} className="card p-4">
            <p className="text-sm text-ink-soft">{k}</p>
            <p className="mt-1 text-2xl font-semibold">{v}</p>
          </div>
        ))}
      </section>

      {list.length === 0 ? (
        <div className="card p-10 text-center">
          <p className="font-semibold">Aucune campagne publicitaire</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-ink-soft">Décrivez ce que vous voulez promouvoir : Publia prépare plusieurs variantes et une proposition de ciblage.</p>
          <Link href="/ads/nouvelle" className="btn-primary mt-5">Créer ma première publicité</Link>
        </div>
      ) : (
        <ul className="grid gap-3">
          {list.map((c) => {
            const st = AD_STATUS[c.status] ?? AD_STATUS.draft;
            const days = daysBetween(c.start_date, c.end_date);
            return (
              <li key={c.id}>
                <Link href={`/ads/${c.id}`} className="card flex flex-wrap items-center gap-3 p-4 transition hover:border-brand-light">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{c.name}</p>
                    <p className="text-sm text-ink-soft">
                      {platformById(c.platform).name} · {AD_OBJECTIVES[c.objective as AdObjective] ?? c.objective} · {euros(c.daily_budget_cents)}/jour · {days} j
                    </p>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${st.cls}`}>{st.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      <section className="card p-5">
        <h2 className="font-semibold">Comptes publicitaires</h2>
        <ul className="mt-3 grid gap-3 sm:grid-cols-2">
          {AD_PLATFORMS.map((p) => (
            <li key={p.id} className="rounded-xl border border-line p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold">{p.name}</p>
                <span className="rounded-full bg-canvas px-2 py-0.5 text-xs font-semibold text-ink-soft">Non connecté</span>
              </div>
              <p className="mt-1 text-xs text-ink-soft">{p.connection}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
