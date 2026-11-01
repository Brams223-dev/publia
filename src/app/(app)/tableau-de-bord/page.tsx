import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Clapperboard, FileImage, PenSquare, Store, SquarePlay } from "lucide-react";
import { getUser } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { planById } from "@/lib/config/plans";
import { PLATFORM_LABELS, type Platform } from "@/lib/config/platforms";

export const metadata: Metadata = { title: "Tableau de bord" };

type Recent = { id: string; title: string | null; platform: Platform; created_at: string; status: string };

async function loadDashboard() {
  const empty = {
    firstName: "",
    businessName: null as string | null,
    plan: planById("free"),
    postsUsed: 0,
    videoCreditsUsed: 0,
    posts: [] as Recent[],
    videos: [] as Recent[],
  };
  if (!isSupabaseConfigured()) return empty;

  const { supabase, user } = await getUser();
  if (!user) return empty;

  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);

  const [profile, business, subscription, usage, videoUsage] = await Promise.all([
    supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
    supabase.from("businesses").select("id, name").eq("owner_id", user.id).order("created_at").limit(1).maybeSingle(),
    supabase.from("subscriptions").select("plan, status").eq("user_id", user.id).maybeSingle(),
    supabase
      .from("usage_logs")
      .select("credits_used")
      .eq("user_id", user.id)
      .in("action", ["generate_post", "generate_youtube"])
      .gte("created_at", monthStart.toISOString()),
    supabase.from("video_usage").select("credits_used").eq("user_id", user.id).gte("created_at", monthStart.toISOString()),
  ]);

  let posts: Recent[] = [];
  let videos: Recent[] = [];
  if (business.data) {
    const [p, v] = await Promise.all([
      supabase
        .from("posts")
        .select("id, title, platform, created_at, status")
        .eq("business_id", business.data.id)
        .order("created_at", { ascending: false })
        .limit(5),
      supabase
        .from("videos")
        .select("id, title, platform, created_at, status")
        .eq("business_id", business.data.id)
        .order("created_at", { ascending: false })
        .limit(5),
    ]);
    posts = (p.data as Recent[]) ?? [];
    videos = (v.data as Recent[]) ?? [];
  }

  const sum = (rows: { credits_used: number }[] | null) => (rows ?? []).reduce((a, r) => a + r.credits_used, 0);
  const activePlan = subscription.data?.status === "active" || subscription.data?.status === "trialing";

  return {
    firstName: (profile.data?.full_name ?? "").split(" ")[0],
    businessName: business.data?.name ?? null,
    plan: planById(activePlan ? subscription.data?.plan : "free"),
    postsUsed: sum(usage.data),
    videoCreditsUsed: sum(videoUsage.data),
    posts,
    videos,
  };
}

const dateFr = (iso: string) =>
  new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" }).format(new Date(iso));

const STATUS_FR: Record<string, string> = {
  draft: "Brouillon",
  ready: "Prête",
  archived: "Archivée",
  pending: "En attente",
  processing: "En cours",
  completed: "Terminée",
  failed: "Échec",
  canceled: "Annulée",
};

function RecentList({ title, items, empty }: { title: string; items: Recent[]; empty: string }) {
  return (
    <section className="card p-5">
      <h2 className="font-semibold">{title}</h2>
      {items.length === 0 ? (
        <p className="mt-3 text-sm text-ink-soft">{empty}</p>
      ) : (
        <ul className="mt-3 divide-y divide-line">
          {items.map((i) => (
            <li key={i.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
              <span className="truncate">{i.title || "Sans titre"}</span>
              <span className="shrink-0 text-ink-soft">
                {PLATFORM_LABELS[i.platform]} · {STATUS_FR[i.status] ?? i.status} · {dateFr(i.created_at)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function SoonAction({ icon: Icon, title, text, phase }: { icon: typeof PenSquare; title: string; text: string; phase: number }) {
  return (
    <div aria-disabled className="card flex cursor-not-allowed items-start gap-4 p-5 opacity-70">
      <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-brand-soft text-brand">
        <Icon className="size-5" />
      </span>
      <div>
        <p className="font-semibold">
          {title}{" "}
          <span className="ml-1 rounded-full bg-canvas px-2 py-0.5 align-middle text-[10px] font-semibold uppercase tracking-wide text-ink-soft">
            Phase {phase}
          </span>
        </p>
        <p className="mt-0.5 text-sm text-ink-soft">{text}</p>
      </div>
    </div>
  );
}

export default async function DashboardPage() {
  const d = await loadDashboard();
  const postsLeft = Math.max(0, d.plan.monthlyPosts - d.postsUsed);
  const videosLeft = Math.max(0, d.plan.monthlyVideoCredits - d.videoCreditsUsed);

  return (
    <div className="mt-4 space-y-6">
      <header>
        <h1 className="text-2xl font-semibold sm:text-3xl">Bonjour{d.firstName ? ` ${d.firstName}` : ""}</h1>
        <p className="mt-1 text-ink-soft">
          {d.businessName ?? "Renseignez votre commerce pour personnaliser vos contenus."}
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="card p-5">
          <p className="text-sm text-ink-soft">Publications restantes ce mois</p>
          <p className="mt-1 text-3xl font-semibold">
            {postsLeft}
            <span className="text-base font-normal text-ink-soft"> / {d.plan.monthlyPosts}</span>
          </p>
        </div>
        <div className="card p-5">
          <p className="text-sm text-ink-soft">Crédits vidéo restants</p>
          <p className="mt-1 text-3xl font-semibold">
            {videosLeft}
            <span className="text-base font-normal text-ink-soft"> / {d.plan.monthlyVideoCredits}</span>
          </p>
        </div>
        <div className="card p-5">
          <p className="text-sm text-ink-soft">Abonnement actuel</p>
          <p className="mt-1 text-3xl font-semibold">{d.plan.name}</p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Link href="/mon-commerce" className="card group flex items-start gap-4 p-5 transition hover:border-brand-light">
          <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-brand text-white">
            <Store className="size-5" />
          </span>
          <div className="flex-1">
            <p className="font-semibold">{d.businessName ? "Mon commerce" : "Renseigner mon commerce"}</p>
            <p className="mt-0.5 text-sm text-ink-soft">Nom, secteur, logo, photos, couleurs et ton de communication.</p>
          </div>
          <ArrowRight className="mt-1 size-4 text-ink-soft transition group-hover:translate-x-0.5 group-hover:text-brand" />
        </Link>
        <SoonAction icon={PenSquare} title="Créer une publication" text="Textes IA pour Instagram, TikTok, Facebook et YouTube." phase={3} />
        <SoonAction icon={FileImage} title="Modèles graphiques" text="12 modèles personnalisables, export PNG haute résolution." phase={4} />
        <SoonAction icon={Clapperboard} title="Créer une vidéo IA" text="Une photo devient une vidéo promotionnelle MP4." phase={5} />
        <SoonAction icon={SquarePlay} title="YouTube Studio" text="Shorts, vidéos 16:9, titres optimisés et miniatures 1280 × 720." phase={6} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <RecentList title="Publications récentes" items={d.posts} empty="Aucune publication pour l'instant." />
        <RecentList title="Vidéos récentes" items={d.videos} empty="Aucune vidéo pour l'instant." />
      </div>
    </div>
  );
}
