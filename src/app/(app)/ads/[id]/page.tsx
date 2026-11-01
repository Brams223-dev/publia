import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FlaskConical, MapPin, Users, Wallet } from "lucide-react";
import { getCurrentBusiness } from "@/lib/business";
import { AD_OBJECTIVES, AD_STATUS, platformById, type AdObjective } from "@/lib/ads/config";
import { daysBetween, euros } from "@/lib/ads/budget";
import { fmt } from "@/lib/autopilot/time";
import { VariantCard, type Variant } from "./variant-card";
import { CampaignControls } from "./campaign-controls";

export const metadata: Metadata = { title: "Campagne publicitaire" };

export default async function AdCampaignPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { supabase, business } = await getCurrentBusiness();
  if (!business) notFound();

  const [{ data: c }, { data: variants }, { data: events }] = await Promise.all([
    supabase
      .from("ad_campaigns")
      .select("id, platform, objective, name, offer, landing_url, geo, audience, daily_budget_cents, spend_cap_cents, start_date, end_date, status, creation_id")
      .eq("id", id)
      .maybeSingle(),
    supabase.from("ad_variants").select("id, angle, headline, primary_text, description, cta, selected").eq("ad_campaign_id", id).order("sort_order"),
    supabase.from("ad_events").select("id, event, detail, created_at").eq("ad_campaign_id", id).order("created_at", { ascending: false }).limit(20),
  ]);
  if (!c) notFound();

  const cfg = platformById(c.platform);
  let imageUrl: string | null = null;
  if (c.creation_id) {
    const { data: cr } = await supabase.from("creations").select("file_path").eq("id", c.creation_id).maybeSingle();
    if (cr) imageUrl = (await supabase.storage.from("uploads").createSignedUrl(cr.file_path, 3600)).data?.signedUrl ?? null;
  }
  const logoUrl = business.logo_url ? (await supabase.storage.from("brand-assets").createSignedUrl(business.logo_url, 3600)).data?.signedUrl ?? null : null;

  const days = daysBetween(c.start_date, c.end_date);
  const geo = c.geo as { city?: string; radius_km?: number };
  const aud = c.audience as { age_min?: number; age_max?: number; interests?: string[]; rationale?: string };
  const status = AD_STATUS[c.status] ?? AD_STATUS.draft;
  const locked = !["draft"].includes(c.status);
  const selected = (variants ?? []).filter((v) => v.selected).length;

  return (
    <div className="mt-4 space-y-6">
      <Link href="/ads" className="text-sm text-ink-soft hover:text-brand">← Publia Ads</Link>

      <div className="flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        <FlaskConical className="mt-0.5 size-4 shrink-0" />
        <p>
          <span className="font-semibold">Mode simulation : cette campagne n&apos;est pas diffusée.</span> Aucune dépense n&apos;est
          engagée. Le lancement réel sera possible après connexion officielle de votre compte {cfg.name}, et uniquement avec votre validation.
        </p>
      </div>

      <header className="card p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-canvas px-2.5 py-1 text-xs font-semibold">{cfg.name}</span>
          <span className="rounded-full bg-canvas px-2.5 py-1 text-xs font-semibold">{AD_OBJECTIVES[c.objective as AdObjective] ?? c.objective}</span>
          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${status.cls}`}>{status.label}</span>
        </div>
        <h1 className="mt-3 text-2xl font-semibold sm:text-3xl">{c.name}</h1>
        <p className="mt-1 text-ink-soft">{c.offer}</p>
        <div className="mt-5"><CampaignControls id={c.id} status={c.status} platformName={cfg.name} /></div>
      </header>

      <section className="grid gap-3 md:grid-cols-3">
        <div className="card p-4">
          <p className="flex items-center gap-2 text-sm font-semibold"><Wallet className="size-4 text-brand" /> Budget</p>
          <p className="mt-2 text-sm">{euros(c.daily_budget_cents)} / jour · {days} jour{days > 1 ? "s" : ""}</p>
          <p className="text-sm">Prévu : <span className="font-semibold">{euros(c.daily_budget_cents * days)}</span> · plafond {euros(c.spend_cap_cents)}</p>
          <p className="mt-1 text-xs text-ink-soft">Du {fmt.dayLong(c.start_date)} au {fmt.dayLong(c.end_date)}</p>
          <p className="mt-1 text-xs text-ink-soft">Dépenses constatées : — (aucune diffusion)</p>
        </div>
        <div className="card p-4">
          <p className="flex items-center gap-2 text-sm font-semibold"><MapPin className="size-4 text-brand" /> Zone proposée</p>
          <p className="mt-2 text-sm">{geo.city ? `${geo.city}, ` : ""}rayon de {geo.radius_km ?? "?"} km</p>
          <p className="mt-1 text-xs text-ink-soft">Audience potentielle : disponible après connexion du compte publicitaire.</p>
        </div>
        <div className="card p-4">
          <p className="flex items-center gap-2 text-sm font-semibold"><Users className="size-4 text-brand" /> Public proposé</p>
          <p className="mt-2 text-sm">{aud.age_min ?? 18} – {aud.age_max ?? 65} ans</p>
          {aud.interests?.length ? <p className="text-sm text-ink-soft">{aud.interests.join(" · ")}</p> : null}
          {aud.rationale && <p className="mt-1 text-xs text-ink-soft">{aud.rationale}</p>}
        </div>
      </section>

      <section>
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold">Ads Factory : comparez les variantes</h2>
            <p className="text-sm text-ink-soft">
              {selected} variante{selected > 1 ? "s" : ""} retenue{selected > 1 ? "s" : ""}. Retenez-en au moins deux pour un test A/B, lorsque votre compte {cfg.name} le permettra.
            </p>
          </div>
          {!c.creation_id && (
            <Link href="/studio" className="text-sm font-semibold text-brand hover:underline">Créer un visuel dans le Studio</Link>
          )}
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {(variants as Variant[] | null)?.map((v, i) => (
            <VariantCard
              key={v.id}
              v={v}
              index={i}
              ctas={cfg.ctas}
              limits={cfg.limits}
              locked={locked}
              preview={{ platform: cfg.preview, businessName: business.name, logoUrl, imageUrl, url: c.landing_url }}
            />
          ))}
        </div>
      </section>

      <section className="card p-5">
        <h2 className="font-semibold">Statistiques</h2>
        <div className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          {["Impressions", "Clics", "Coût par clic", "Prospects"].map((k) => (
            <div key={k} className="rounded-xl bg-canvas p-3">
              <p className="text-ink-soft">{k}</p>
              <p className="mt-1 text-xl font-semibold">—</p>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-ink-soft">Les indicateurs proviendront uniquement de {cfg.name} une fois le compte connecté et la campagne réellement diffusée.</p>
      </section>

      {events?.length ? (
        <section className="card p-5">
          <h2 className="font-semibold">Historique</h2>
          <ul className="mt-2 divide-y divide-line text-sm">
            {events.map((e) => (
              <li key={e.id} className="flex justify-between gap-3 py-2">
                <span>{{ created: "Brouillon créé", variants_generated: "Variantes générées", edited: "Modifié", validated: "Brouillon validé", archived: "Archivée" }[e.event as string] ?? e.event}{e.detail ? ` · ${e.detail}` : ""}</span>
                <span className="shrink-0 text-ink-soft">{fmt.full(new Date(e.created_at))}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <p className="text-xs text-ink-soft">Connexion requise pour le lancement réel : {cfg.connection}</p>
    </div>
  );
}
