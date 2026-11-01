import type { Metadata } from "next";
import { formatDay } from "@/lib/format";
import Link from "next/link";
import { Megaphone, Sparkles } from "lucide-react";
import { getUser } from "@/lib/supabase/server";
import { OBJECTIVES } from "@/lib/campaigns/config";

export const metadata: Metadata = { title: "Campagnes" };

const shortDate = (iso: string) => formatDay(iso, "short");

export default async function CampaignsPage() {
  const { supabase, user } = await getUser();
  if (!user) return null;
  const { data: campaigns } = await supabase
    .from("campaigns")
    .select("id, title, objective, start_date, duration_days, status, posts(count)")
    .order("created_at", { ascending: false })
    .limit(50);

  return (
    <div className="mt-4 space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold sm:text-3xl">Campagnes</h1>
          <p className="mt-1 text-ink-soft">Toutes les campagnes préparées par Publia.</p>
        </div>
        <Link href="/fais-ma-communication" className="btn-primary">
          <Sparkles className="size-4" /> Nouvelle campagne
        </Link>
      </header>

      {!campaigns?.length ? (
        <div className="card flex flex-col items-center p-10 text-center">
          <span className="grid size-12 place-items-center rounded-2xl bg-brand-soft text-brand">
            <Megaphone className="size-6" />
          </span>
          <p className="mt-4 font-semibold">Aucune campagne pour l&apos;instant</p>
          <p className="mt-1 max-w-sm text-sm text-ink-soft">Choisissez un objectif et Publia prépare votre communication de la semaine.</p>
          <Link href="/fais-ma-communication" className="btn-primary mt-5">Fais ma communication</Link>
        </div>
      ) : (
        <ul className="grid gap-3">
          {campaigns.map((c) => {
            const count = (c.posts as unknown as { count: number }[])?.[0]?.count ?? 0;
            return (
              <li key={c.id}>
                <Link href={`/campagnes/${c.id}`} className="card flex flex-wrap items-center gap-3 p-4 transition hover:border-brand-light sm:p-5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{c.title ?? "Campagne"}</p>
                    <p className="text-sm text-ink-soft">
                      {OBJECTIVES.find((o) => o.id === c.objective)?.label} · {count} contenus · dès le {shortDate(c.start_date)}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                      c.status === "validated" ? "bg-success/10 text-success" : "bg-amber-50 text-amber-800"
                    }`}
                  >
                    {c.status === "validated" ? "Validée" : "À relire"}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
