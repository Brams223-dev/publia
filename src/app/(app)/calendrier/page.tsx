import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Plane } from "lucide-react";
import { getCurrentBusiness } from "@/lib/business";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { addDays, DEFAULT_TZ, fmt, localDay, startOfWeek, zonedToUtc } from "@/lib/autopilot/time";
import { ScheduledItem, PlatformDot, type ScheduledPost } from "./scheduled-item";

export const metadata: Metadata = { title: "Calendrier" };

type View = "jour" | "semaine" | "mois" | "programmees" | "historique";
const VIEWS: { id: View; label: string }[] = [
  { id: "jour", label: "Jour" },
  { id: "semaine", label: "Semaine" },
  { id: "mois", label: "Mois" },
  { id: "programmees", label: "Programmées" },
  { id: "historique", label: "Historique" },
];

const EVENT_LABELS: Record<string, string> = {
  scheduled: "Programmé",
  rescheduled: "Déplacé",
  paused: "Mis en pause",
  resumed: "Repris",
  canceled: "Déprogrammé",
  published_manual: "Publié manuellement",
  published: "Publié automatiquement",
  failed: "Échec de publication",
};

function range(view: View, day: string) {
  if (view === "jour") return { from: day, to: addDays(day, 1) };
  if (view === "semaine") {
    const s = startOfWeek(day);
    return { from: s, to: addDays(s, 7) };
  }
  const first = `${day.slice(0, 7)}-01`;
  const s = startOfWeek(first);
  return { from: s, to: addDays(s, 42) };
}

function shift(view: View, day: string, dir: 1 | -1) {
  if (view === "jour") return addDays(day, dir);
  if (view === "semaine") return addDays(day, 7 * dir);
  const d = new Date(`${day.slice(0, 7)}-01T12:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + dir);
  return d.toISOString().slice(0, 10);
}

const SELECT = "id, campaign_id, platform, format, title, caption, call_to_action, hashtags, publish_status, scheduled_at, published_at";

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ vue?: string; date?: string }> }) {
  if (!isSupabaseConfigured()) return null;
  const sp = await searchParams;
  const view: View = (VIEWS.find((v) => v.id === sp.vue)?.id ?? "semaine") as View;
  const today = localDay(new Date(), DEFAULT_TZ).iso;
  const day = sp.date && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : today;
  const { supabase, business } = await getCurrentBusiness();
  if (!business) return null;

  const withLocal = (rows: Omit<ScheduledPost, "localDay" | "localTime">[]): ScheduledPost[] =>
    rows.map((r) => {
      const l = r.scheduled_at ? localDay(new Date(r.scheduled_at)) : { iso: "", time: "" };
      return { ...r, localDay: l.iso, localTime: l.time };
    });

  let posts: ScheduledPost[] = [];
  let events: { id: string; event: string; created_at: string; scheduled_at: string | null; posts: { title: string | null; platform: string } | null }[] = [];
  const r = range(view, day);

  if (view === "historique") {
    const { data } = await supabase
      .from("publish_events")
      .select("id, event, created_at, scheduled_at, posts(title, platform)")
      .eq("business_id", business.id)
      .order("created_at", { ascending: false })
      .limit(100);
    events = (data ?? []) as unknown as typeof events;
  } else if (view === "programmees") {
    const { data } = await supabase
      .from("posts")
      .select(SELECT)
      .eq("business_id", business.id)
      .in("publish_status", ["scheduled", "paused", "failed"])
      .order("scheduled_at")
      .limit(200);
    posts = withLocal((data ?? []) as never);
  } else {
    const { data } = await supabase
      .from("posts")
      .select(SELECT)
      .eq("business_id", business.id)
      .not("scheduled_at", "is", null)
      .neq("publish_status", "canceled")
      .gte("scheduled_at", zonedToUtc(r.from, "00:00").toISOString())
      .lt("scheduled_at", zonedToUtc(r.to, "00:00").toISOString())
      .order("scheduled_at");
    posts = withLocal((data ?? []) as never);
  }

  const byDay = new Map<string, ScheduledPost[]>();
  for (const p of posts) byDay.set(p.localDay, [...(byDay.get(p.localDay) ?? []), p]);
  const due = posts.filter((p) => p.publish_status === "scheduled" && p.scheduled_at && new Date(p.scheduled_at) <= new Date());
  const href = (v: View, d = day) => `/calendrier?vue=${v}&date=${d}`;
  const navigable = view === "jour" || view === "semaine" || view === "mois";
  const title = view === "jour" ? fmt.dayLong(day) : view === "semaine" ? `Semaine du ${fmt.dayLong(startOfWeek(day))}` : fmt.month(day);

  return (
    <div className="mt-4 space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold sm:text-3xl">Calendrier de publication</h1>
          <p className="mt-1 text-ink-soft">Heure de Paris. Touchez un contenu pour le copier, le déplacer ou le marquer publié.</p>
        </div>
        <Link href="/autopilot" className="btn-ghost"><Plane className="size-4" /> Réglages Autopilot</Link>
      </header>

      <nav className="flex gap-1 overflow-x-auto rounded-full border border-line bg-white p-1">
        {VIEWS.map((v) => (
          <Link
            key={v.id}
            href={href(v.id)}
            className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium ${view === v.id ? "bg-brand text-white" : "text-ink-soft hover:text-ink"}`}
          >
            {v.label}
          </Link>
        ))}
      </nav>

      {due.length > 0 && view !== "historique" && (
        <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {due.length} contenu{due.length > 1 ? "s" : ""} à publier maintenant : copiez-le{due.length > 1 ? "s" : ""} et publiez sur vos réseaux, puis « Marquer publié ».
        </p>
      )}

      {navigable && (
        <div className="flex items-center gap-2">
          <Link href={href(view, shift(view, day, -1))} aria-label="Précédent" className="btn-ghost p-2"><ChevronLeft className="size-4" /></Link>
          <Link href={href(view, shift(view, day, 1))} aria-label="Suivant" className="btn-ghost p-2"><ChevronRight className="size-4" /></Link>
          <Link href={href(view, today)} className="btn-ghost px-4 py-2">Aujourd&apos;hui</Link>
          <p className="ml-2 font-semibold first-letter:uppercase">{title}</p>
        </div>
      )}

      {view === "mois" && (
        <div className="card overflow-hidden">
          <div className="grid grid-cols-7 border-b border-line bg-canvas text-center text-xs font-semibold text-ink-soft">
            {["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"].map((d) => <div key={d} className="py-2">{d}</div>)}
          </div>
          <div className="grid grid-cols-7">
            {Array.from({ length: 42 }, (_, i) => addDays(r.from, i)).map((d) => {
              const items = byDay.get(d) ?? [];
              const inMonth = d.slice(0, 7) === day.slice(0, 7);
              return (
                <Link
                  key={d}
                  href={href("jour", d)}
                  className={`min-h-20 border-r border-b border-line p-1.5 text-xs hover:bg-brand-soft/50 sm:min-h-24 ${inMonth ? "" : "bg-canvas/60 text-ink-soft/60"}`}
                >
                  <span className={`inline-grid size-6 place-items-center rounded-full ${d === today ? "bg-brand font-semibold text-white" : ""}`}>{+d.slice(8)}</span>
                  <span className="mt-1 flex flex-wrap gap-1">
                    {items.slice(0, 4).map((p) => <PlatformDot key={p.id} platform={p.platform} />)}
                  </span>
                  {items.length > 0 && <span className="mt-1 hidden text-[11px] text-ink-soft sm:block">{items.length} contenu{items.length > 1 ? "s" : ""}</span>}
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {view === "semaine" && (
        <div className="grid gap-3 lg:grid-cols-7">
          {Array.from({ length: 7 }, (_, i) => addDays(r.from, i)).map((d) => (
            <section key={d} className={`rounded-2xl p-2 ${d === today ? "bg-brand-soft" : "bg-white/60"}`}>
              <Link href={href("jour", d)} className="mb-2 block px-1 text-sm font-semibold capitalize hover:text-brand">{fmt.dayShort(d)}</Link>
              <div className="space-y-2">
                {(byDay.get(d) ?? []).map((p) => <ScheduledItem key={p.id} post={p} compact />)}
                {!byDay.get(d)?.length && <p className="px-1 text-xs text-ink-soft/70">—</p>}
              </div>
            </section>
          ))}
        </div>
      )}

      {(view === "jour" || view === "programmees") && (
        <div className="space-y-6">
          {posts.length === 0 && (
            <div className="card p-8 text-center text-sm text-ink-soft">
              Rien de programmé ici. Validez des contenus dans vos <Link href="/campagnes" className="font-semibold text-brand">campagnes</Link>, puis planifiez-les avec l&apos;<Link href="/autopilot" className="font-semibold text-brand">Autopilot</Link>.
            </div>
          )}
          {[...byDay.entries()].map(([d, items]) => (
            <section key={d}>
              {view === "programmees" && <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-ink-soft">{fmt.dayLong(d)}</h2>}
              <div className="grid gap-2 md:grid-cols-2">
                {items.map((p) => <ScheduledItem key={p.id} post={p} />)}
              </div>
            </section>
          ))}
        </div>
      )}

      {view === "historique" && (
        <div className="card divide-y divide-line">
          {events.length === 0 && <p className="p-6 text-center text-sm text-ink-soft">Aucun événement de diffusion pour l&apos;instant.</p>}
          {events.map((e) => (
            <div key={e.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 text-sm">
              <span className="w-full text-xs text-ink-soft sm:w-40">{fmt.full(new Date(e.created_at))}</span>
              <span className="font-medium">{EVENT_LABELS[e.event] ?? e.event}</span>
              <span className="min-w-0 flex-1 truncate text-ink-soft">{e.posts?.title}</span>
              {e.scheduled_at && <span className="text-xs text-ink-soft">pour le {fmt.full(new Date(e.scheduled_at))}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
