import type { Metadata } from "next";
import { formatDay } from "@/lib/format";
import Link from "next/link";
import { ArrowRight, BadgeEuro, BarChart3, Bot, Briefcase, Palette, Plane, Shirt, Sparkles, Store } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { getCurrentBusiness, profileCompleteness } from "@/lib/business";
import { getQuota, type Quota } from "@/lib/quota";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { OBJECTIVES } from "@/lib/campaigns/config";

export const metadata: Metadata = { title: "Tableau de bord" };

type Module = { label: string; href?: string };
type Pillar = { name: string; tagline: string; icon: LucideIcon; modules: Module[] };

// Un module avec `href` est opérationnel ; sans `href`, il est annoncé comme à venir.
const PILLARS: Pillar[] = [
  {
    name: "Assistant",
    tagline: "Le cerveau marketing de votre commerce",
    icon: Bot,
    modules: [
      { label: "Fais ma communication", href: "/fais-ma-communication" },
      { label: "Campagnes", href: "/campagnes" },
      { label: "Assistant conversationnel" },
      { label: "Calendrier éditorial" },
    ],
  },
  {
    name: "Autopilot",
    tagline: "Programmez à l'avance, publiez au bon moment",
    icon: Plane,
    modules: [
      { label: "Réglages et créneaux", href: "/autopilot" },
      { label: "Calendrier", href: "/calendrier" },
      { label: "Comptes sociaux", href: "/comptes-sociaux" },
      { label: "Publication automatique" },
    ],
  },
  {
    name: "Studio",
    tagline: "Vos visuels, vidéos et contenus YouTube",
    icon: Palette,
    modules: [{ label: "Studio créatif", href: "/studio" }, { label: "Bibliothèque", href: "/bibliotheque" }, { label: "Studio vidéo" }, { label: "YouTube Studio" }],
  },
  {
    name: "Ads",
    tagline: "Vos publicités préparées par l'IA",
    icon: BadgeEuro,
    modules: [
      { label: "Campagnes publicitaires", href: "/ads" },
      { label: "Nouvelle publicité", href: "/ads/nouvelle" },
      { label: "Lancement réel" },
      { label: "Optimisation IA" },
    ],
  },
  {
    name: "Fashion",
    tagline: "Photos de mode, mannequins virtuels et ventes",
    icon: Shirt,
    modules: [{ label: "Photo produit" }, { label: "Mannequin virtuel" }, { label: "Mon Avatar" }, { label: "Fashion Motion" }, { label: "Vinted Studio" }],
  },
  {
    name: "Business",
    tagline: "Attirer, fidéliser, répondre",
    icon: Briefcase,
    modules: [{ label: "Avis clients" }, { label: "Visibilité locale" }, { label: "Contacts" }, { label: "Fidélité" }, { label: "Mini-site" }],
  },
  {
    name: "Intelligence",
    tagline: "Comprendre ce qui fonctionne",
    icon: BarChart3,
    modules: [{ label: "Performances" }, { label: "Recommandations" }, { label: "Rapports" }],
  },
];

const shortDate = (iso: string) => formatDay(iso, "short");

async function load() {
  if (!isSupabaseConfigured()) return null;
  const { supabase, user, business } = await getCurrentBusiness();
  if (!user) return null;
  const [quota, profile, campaigns] = await Promise.all([
    getQuota(supabase, user.id),
    supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
    business
      ? supabase
          .from("campaigns")
          .select("id, title, objective, start_date, status")
          .eq("business_id", business.id)
          .order("created_at", { ascending: false })
          .limit(4)
      : Promise.resolve({ data: [] as { id: string; title: string | null; objective: string; start_date: string; status: string }[] }),
  ]);
  return {
    firstName: (profile.data?.full_name ?? "").split(" ")[0],
    business,
    quota,
    completeness: profileCompleteness(business),
    campaigns: campaigns.data ?? [],
  };
}

function Stat({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="card p-4 sm:p-5">
      <p className="text-xs text-ink-soft sm:text-sm">{label}</p>
      <p className="mt-1 text-2xl font-semibold sm:text-3xl">
        {value}
        {sub && <span className="text-sm font-normal text-ink-soft sm:text-base"> {sub}</span>}
      </p>
    </div>
  );
}

function Stats({ quota, completeness }: { quota: Quota; completeness: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Stat label="Générations restantes" value={Math.max(0, quota.generationsQuota - quota.generationsUsed)} sub={`/ ${quota.generationsQuota}`} />
      <Stat label="Crédits vidéo" value={Math.max(0, quota.videoQuota - quota.videoUsed)} sub={`/ ${quota.videoQuota}`} />
      <Stat label="Offre" value={quota.planName} />
      <Stat label="Profil complété" value={`${completeness} %`} />
    </div>
  );
}

export default async function DashboardPage() {
  const d = await load();

  return (
    <div className="mt-4 space-y-6">
      <header>
        <h1 className="text-2xl font-semibold sm:text-3xl">Bonjour{d?.firstName ? ` ${d.firstName}` : ""}</h1>
        <p className="mt-1 text-ink-soft">{d?.business?.name ?? "Bienvenue sur Publia, votre responsable marketing virtuel."}</p>
      </header>

      {/* Action principale */}
      <section className="relative overflow-hidden rounded-[1.75rem] bg-gradient-to-br from-brand to-brand-light p-6 text-white shadow-[0_18px_40px_rgb(107_85_217/0.35)] sm:p-8">
        <div aria-hidden className="absolute -top-16 -right-16 size-56 rounded-full bg-white/10" />
        <div aria-hidden className="absolute -right-6 -bottom-20 size-40 rounded-full bg-white/10" />
        <div className="relative max-w-xl">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold">
            <Sparkles className="size-3.5" /> Fonction phare
          </span>
          <h2 className="mt-4 text-2xl font-bold sm:text-3xl">Fais ma communication</h2>
          <p className="mt-2 text-white/85">
            Choisissez un objectif : Publia prépare une campagne complète pour Instagram, Facebook, TikTok et YouTube Shorts,
            avec textes, hashtags et calendrier.
          </p>
          {d?.business ? (
            <Link href="/fais-ma-communication" className="btn mt-6 bg-white px-6 py-3 text-base text-brand hover:bg-brand-soft">
              Préparer une campagne <ArrowRight className="size-4" />
            </Link>
          ) : (
            <Link href="/mon-commerce" className="btn mt-6 bg-white px-6 py-3 text-base text-brand hover:bg-brand-soft">
              <Store className="size-4" /> Commencer par mon commerce
            </Link>
          )}
        </div>
      </section>

      {d && <Stats quota={d.quota} completeness={d.completeness} />}

      {d && d.completeness < 75 && (
        <Link href="/mon-commerce" className="card group flex items-center gap-4 p-4 transition hover:border-brand-light sm:p-5">
          <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-brand-soft text-brand">
            <Store className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-semibold">{d.business ? "Complétez votre profil" : "Présentez votre commerce"}</p>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-canvas">
              <div className="h-full rounded-full bg-brand" style={{ width: `${d.completeness}%` }} />
            </div>
          </div>
          <ArrowRight className="size-4 text-ink-soft transition group-hover:translate-x-0.5 group-hover:text-brand" />
        </Link>
      )}

      {/* Les quatre piliers */}
      <section>
        <h2 className="mb-3 text-lg font-semibold">Votre espace Publia</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {PILLARS.map(({ name, tagline, icon: Icon, modules }) => {
            const live = modules.filter((m) => m.href).length;
            return (
              <div key={name} className="card p-5">
                <div className="flex items-center gap-3">
                  <span className={`grid size-10 place-items-center rounded-2xl ${live ? "bg-brand text-white" : "bg-brand-soft text-brand"}`}>
                    <Icon className="size-5" />
                  </span>
                  <div>
                    <p className="font-semibold">Publia {name}</p>
                    <p className="text-sm text-ink-soft">{tagline}</p>
                  </div>
                </div>
                <ul className="mt-4 flex flex-wrap gap-2">
                  {modules.map((m) =>
                    m.href ? (
                      <li key={m.label}>
                        <Link href={m.href} className="inline-flex items-center gap-1.5 rounded-full bg-brand-soft px-3 py-1.5 text-sm font-medium text-brand hover:bg-brand hover:text-white">
                          <span className="size-1.5 rounded-full bg-current" /> {m.label}
                        </Link>
                      </li>
                    ) : (
                      <li key={m.label} className="inline-flex items-center gap-1.5 rounded-full bg-canvas px-3 py-1.5 text-sm text-ink-soft" title="Bientôt disponible">
                        {m.label}
                      </li>
                    ),
                  )}
                </ul>
              </div>
            );
          })}
        </div>
      </section>

      {d && (
        <section className="card p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Campagnes récentes</h2>
            {d.campaigns.length > 0 && (
              <Link href="/campagnes" className="text-sm font-medium text-brand hover:underline">Tout voir</Link>
            )}
          </div>
          {d.campaigns.length === 0 ? (
            <p className="mt-3 text-sm text-ink-soft">Aucune campagne pour l&apos;instant. Lancez « Fais ma communication » pour préparer la première.</p>
          ) : (
            <ul className="mt-3 divide-y divide-line">
              {d.campaigns.map((c) => (
                <li key={c.id}>
                  <Link href={`/campagnes/${c.id}`} className="flex items-center justify-between gap-3 py-3 text-sm hover:text-brand">
                    <span className="min-w-0 truncate font-medium">{c.title ?? "Campagne"}</span>
                    <span className="shrink-0 text-ink-soft">
                      {OBJECTIVES.find((o) => o.id === c.objective)?.label} · {shortDate(c.start_date)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
