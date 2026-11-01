import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getUser } from "@/lib/supabase/server";
import { OBJECTIVES } from "@/lib/campaigns/config";
import { PostCard, type Post } from "./post-card";
import { CampaignActions } from "./campaign-actions";

export const metadata: Metadata = { title: "Campagne" };

const longDate = (iso: string) =>
  new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(`${iso}T12:00:00Z`));

export default async function CampaignPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { supabase, user } = await getUser();
  if (!user) notFound();

  const [{ data: campaign }, { data: posts }] = await Promise.all([
    supabase
      .from("campaigns")
      .select("id, title, summary, strategy, objective, brief, start_date, duration_days, status, created_at")
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("posts")
      .select("id, platform, format, title, caption, short_caption, call_to_action, hashtags, visual_idea, status, scheduled_for")
      .eq("campaign_id", id)
      .order("scheduled_for")
      .order("created_at"),
  ]);
  if (!campaign) notFound();

  const items = (posts ?? []) as (Post & { scheduled_for: string })[];
  const byDay = new Map<string, typeof items>();
  for (const p of items) byDay.set(p.scheduled_for, [...(byDay.get(p.scheduled_for) ?? []), p]);
  const readyCount = items.filter((p) => p.status === "ready").length;
  const objective = OBJECTIVES.find((o) => o.id === campaign.objective)?.label;

  return (
    <div className="mt-4 space-y-6">
      <Link href="/campagnes" className="inline-flex items-center gap-1.5 text-sm text-ink-soft hover:text-brand">
        <ArrowLeft className="size-4" /> Toutes les campagnes
      </Link>

      <header className="card p-5 sm:p-6">
        <p className="text-sm font-medium text-brand">{objective}</p>
        <h1 className="mt-1 text-2xl font-semibold sm:text-3xl">{campaign.title}</h1>
        {campaign.summary && <p className="mt-2 text-ink-soft">{campaign.summary}</p>}
        {campaign.strategy && (
          <p className="mt-4 rounded-xl bg-brand-soft px-4 py-3 text-sm">
            <span className="font-semibold">Stratégie : </span>
            {campaign.strategy}
          </p>
        )}
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-ink-soft">
            {items.length} contenus · {readyCount} validé{readyCount > 1 ? "s" : ""} · à partir du {longDate(campaign.start_date)}
          </p>
          <CampaignActions id={campaign.id} allReady={items.length > 0 && readyCount === items.length} />
        </div>
      </header>

      <p className="text-sm text-ink-soft">
        Relisez chaque contenu, modifiez-le si besoin puis validez-le. La publication se fait ensuite depuis vos réseaux,
        en copiant les textes : la publication automatique arrivera après validation officielle des plateformes.
      </p>

      <ol className="space-y-8">
        {[...byDay.entries()].map(([day, dayPosts]) => (
          <li key={day}>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-soft">{longDate(day)}</h2>
            <div className="grid gap-4 lg:grid-cols-2">
              {dayPosts.map((p) => (
                <PostCard key={p.id} post={p} />
              ))}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
