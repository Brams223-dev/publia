import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays, Plane, Plug } from "lucide-react";
import { z } from "zod";
import { getCurrentBusiness } from "@/lib/business";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { ruleSchema, SCHEDULABLE_PLATFORMS } from "@/lib/autopilot/scheduler";
import { recommendSlots } from "@/lib/autopilot/recommendations";
import { AutopilotForm } from "./autopilot-form";

export const metadata: Metadata = { title: "Autopilot" };

export default async function AutopilotPage() {
  if (!isSupabaseConfigured()) return null;
  const { supabase, business } = await getCurrentBusiness();

  if (!business)
    return (
      <div className="mt-4 card p-6">
        <p className="font-semibold">Présentez d&apos;abord votre commerce</p>
        <Link href="/mon-commerce" className="btn-primary mt-4">Renseigner mon commerce</Link>
      </div>
    );

  const [{ data: settings }, { count: pendingCount }, { count: scheduledCount }] = await Promise.all([
    supabase.from("autopilot_settings").select("enabled, weeks_ahead, rules").eq("business_id", business.id).maybeSingle(),
    supabase.from("posts").select("id", { count: "exact", head: true }).eq("business_id", business.id).eq("status", "ready").eq("publish_status", "unscheduled"),
    supabase.from("posts").select("id", { count: "exact", head: true }).eq("business_id", business.id).eq("publish_status", "scheduled"),
  ]);

  const rules = z.array(ruleSchema).safeParse(settings?.rules ?? []);

  return (
    <div className="mt-4 space-y-6">
      <header className="flex items-start gap-4">
        <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-brand text-white">
          <Plane className="size-6" />
        </span>
        <div>
          <h1 className="text-2xl font-semibold sm:text-3xl">Publia Autopilot</h1>
          <p className="mt-1 text-ink-soft">Définissez votre rythme : Publia place vos contenus validés sur les bons créneaux.</p>
        </div>
      </header>

      <div className="grid gap-3 sm:grid-cols-2">
        <Link href="/calendrier" className="card flex items-center gap-3 p-4 transition hover:border-brand-light">
          <CalendarDays className="size-5 text-brand" />
          <span className="flex-1 text-sm"><span className="font-semibold">{scheduledCount ?? 0}</span> publication{(scheduledCount ?? 0) > 1 ? "s" : ""} programmée{(scheduledCount ?? 0) > 1 ? "s" : ""}</span>
          <span className="text-sm font-semibold text-brand">Calendrier</span>
        </Link>
        <Link href="/comptes-sociaux" className="card flex items-center gap-3 p-4 transition hover:border-brand-light">
          <Plug className="size-5 text-brand" />
          <span className="flex-1 text-sm">Publication automatique : <span className="font-semibold">non connectée</span></span>
          <span className="text-sm font-semibold text-brand">Comptes</span>
        </Link>
      </div>

      <div className="rounded-2xl border border-line bg-white px-4 py-3 text-sm text-ink-soft">
        <span className="font-semibold text-ink">Comment ça marche aujourd&apos;hui : </span>
        Publia programme vos contenus dans le calendrier. À l&apos;heure prévue, ils passent « À publier » : vous les copiez
        en un clic et les publiez sur vos réseaux. La publication automatique s&apos;activera réseau par réseau, après
        validation des accès officiels des plateformes.
      </div>

      <AutopilotForm
        initial={{ enabled: settings?.enabled ?? false, weeksAhead: settings?.weeks_ahead ?? 2, rules: rules.success ? rules.data : [] }}
        recommendations={recommendSlots(SCHEDULABLE_PLATFORMS, business.category)}
        pendingCount={pendingCount ?? 0}
      />
    </div>
  );
}
