import type { Metadata } from "next";
import Link from "next/link";
import { Search, Users } from "lucide-react";
import { getCurrentBusiness } from "@/lib/business";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { displayName } from "@/lib/contacts";
import { formatInstant, formatNumber } from "@/lib/format";
import { ContactTools } from "./contact-tools";

export const metadata: Metadata = { title: "Contacts" };

const PAGE = 50;
type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)?.trim() ?? "";
const SOURCE: Record<string, string> = { manual: "Ajout manuel", import: "Import", minisite: "Mini-site", review: "Avis", loyalty: "Fidélité" };

export default async function ContactsPage({ searchParams }: { searchParams: Promise<SP> }) {
  if (!isSupabaseConfigured()) return null;
  const sp = await searchParams;
  const { supabase, business } = await getCurrentBusiness();
  if (!business)
    return (
      <div className="mt-4 card p-6">
        <p className="font-semibold">Présentez d&apos;abord votre commerce</p>
        <Link href="/mon-commerce" className="btn-primary mt-4">Renseigner mon commerce</Link>
      </div>
    );

  const q = one(sp.q).slice(0, 100);
  const tag = one(sp.tag).toLowerCase().slice(0, 30);
  const consent = one(sp.consent);
  const page = Math.max(1, Number(one(sp.page)) || 1);
  const like = (s: string) => `%${s.replace(/[%_,()\\]/g, " ")}%`;

  let query = supabase
    .from("contacts")
    .select("id, first_name, last_name, email, phone, tags, marketing_consent, source, last_interaction_at, created_at", { count: "exact" })
    .eq("business_id", business.id);
  if (q) query = query.or(`first_name.ilike.${like(q)},last_name.ilike.${like(q)},email.ilike.${like(q)},phone.ilike.${like(q)}`);
  if (tag) query = query.contains("tags", [tag]);
  if (consent === "oui") query = query.eq("marketing_consent", true);
  if (consent === "non") query = query.eq("marketing_consent", false);
  const from = (page - 1) * PAGE;
  const [{ data: rows, count }, { count: total }, { count: consenting }, { data: tagRows }] = await Promise.all([
    query.order("created_at", { ascending: false }).range(from, from + PAGE - 1),
    supabase.from("contacts").select("id", { count: "exact", head: true }).eq("business_id", business.id),
    supabase.from("contacts").select("id", { count: "exact", head: true }).eq("business_id", business.id).eq("marketing_consent", true),
    supabase.from("contacts").select("tags").eq("business_id", business.id).neq("tags", "{}").limit(1000),
  ]);
  const tags = Array.from(new Set((tagRows ?? []).flatMap((r) => r.tags as string[]))).sort().slice(0, 50);
  const pages = Math.max(1, Math.ceil((count ?? 0) / PAGE));
  const qs = (patch: Record<string, string | number | null>) => {
    const u = new URLSearchParams();
    for (const [k, v] of Object.entries(sp)) if (typeof v === "string" && v) u.set(k, v);
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === "") u.delete(k);
      else u.set(k, String(v));
    }
    const s = u.toString();
    return s ? `/contacts?${s}` : "/contacts";
  };

  return (
    <div className="mt-4 space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex items-start gap-4">
          <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-brand text-white"><Users className="size-6" /></span>
          <div>
            <h1 className="text-2xl font-semibold sm:text-3xl">Contacts</h1>
            <p className="mt-1 text-ink-soft">Vos clients, leurs coordonnées et leur accord pour recevoir vos offres.</p>
          </div>
        </div>
      </header>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        {[
          ["Contacts", formatNumber(total ?? 0)],
          ["Acceptent vos offres", formatNumber(consenting ?? 0)],
          ["Sans consentement", formatNumber((total ?? 0) - (consenting ?? 0))],
        ].map(([k, v]) => (
          <div key={k} className="card p-4">
            <p className="text-sm text-ink-soft">{k}</p>
            <p className="mt-1 text-2xl font-semibold">{v}</p>
          </div>
        ))}
      </section>

      <ContactTools />

      <form action="/contacts" className="card flex flex-wrap items-end gap-3 p-4">
        <div className="min-w-[14rem] flex-1">
          <label className="label" htmlFor="q">Recherche</label>
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-soft" />
            <input id="q" name="q" defaultValue={q} placeholder="Nom, e-mail, téléphone…" className="input pl-9" />
          </div>
        </div>
        <div>
          <label className="label" htmlFor="tag">Étiquette</label>
          <select id="tag" name="tag" defaultValue={tag} className="input">
            <option value="">Toutes</option>
            {tags.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="consent">Consentement</label>
          <select id="consent" name="consent" defaultValue={consent} className="input">
            <option value="">Tous</option>
            <option value="oui">Acceptent les offres</option>
            <option value="non">Sans consentement</option>
          </select>
        </div>
        <button className="btn-primary">Filtrer</button>
        {q || tag || consent ? <Link href="/contacts" className="btn-ghost">Effacer</Link> : null}
      </form>

      {(total ?? 0) === 0 ? (
        <div className="card p-10 text-center">
          <p className="font-semibold">Aucun contact pour le moment</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-ink-soft">
            Ajoutez vos clients un par un, importez un fichier, ou laissez-les venir : les messages de votre mini-site et les cartes
            de fidélité créent des contacts automatiquement.
          </p>
        </div>
      ) : (rows ?? []).length === 0 ? (
        <div className="card p-8 text-center text-sm text-ink-soft">Aucun contact ne correspond à ces filtres.</div>
      ) : (
        <>
          <ul className="card divide-y divide-line">
            {(rows ?? []).map((c) => (
              <li key={c.id}>
                <Link href={`/contacts/${c.id}`} className="flex flex-wrap items-center gap-3 px-4 py-3 transition hover:bg-canvas">
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-brand-soft text-sm font-semibold text-brand">
                    {displayName(c).charAt(0).toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{displayName(c)}</span>
                    <span className="block truncate text-xs text-ink-soft">{[c.email, c.phone].filter(Boolean).join(" · ") || "—"}</span>
                  </span>
                  <span className="flex flex-wrap gap-1">
                    {(c.tags as string[]).slice(0, 3).map((t) => <span key={t} className="rounded-full bg-canvas px-2 py-0.5 text-xs">{t}</span>)}
                  </span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${c.marketing_consent ? "bg-success/10 text-success" : "bg-neutral-100 text-neutral-600"}`}>
                    {c.marketing_consent ? "Accepte les offres" : "Sans consentement"}
                  </span>
                  <span className="hidden w-36 text-right text-xs text-ink-soft sm:block">
                    {SOURCE[c.source] ?? c.source} · {formatInstant(c.last_interaction_at ?? c.created_at, "dayMonthYear")}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          {pages > 1 ? (
            <nav className="flex items-center justify-center gap-2 text-sm">
              {page > 1 ? <Link href={qs({ page: page - 1 })} className="btn-ghost">Précédent</Link> : null}
              <span className="text-ink-soft">Page {page} / {pages}</span>
              {page < pages ? <Link href={qs({ page: page + 1 })} className="btn-ghost">Suivant</Link> : null}
            </nav>
          ) : null}
        </>
      )}
    </div>
  );
}
