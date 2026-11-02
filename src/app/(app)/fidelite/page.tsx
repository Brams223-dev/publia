import type { Metadata } from "next";
import Link from "next/link";
import { Gift, Search } from "lucide-react";
import { canManage, getCurrentBusiness } from "@/lib/business";
import { isSupabaseConfigured, SITE_URL } from "@/lib/supabase/env";
import { displayName } from "@/lib/contacts";
import { formatInstant, formatMoney } from "@/lib/format";
import { ProgramForm, EnrollForm, CreateCardButton } from "./forms";
import { CardPanel } from "./card-panel";

export const metadata: Metadata = { title: "Fidélité" };
type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)?.trim() ?? "";
const isId = (v: string) => /^[0-9a-f-]{36}$/i.test(v);

export default async function LoyaltyPage({ searchParams }: { searchParams: Promise<SP> }) {
  if (!isSupabaseConfigured()) return null;
  const sp = await searchParams;
  const { supabase, business, role } = await getCurrentBusiness();
  if (!business)
    return (
      <div className="mt-4 card p-6">
        <p className="font-semibold">Présentez d&apos;abord votre commerce</p>
        <Link href="/mon-commerce" className="btn-primary mt-4">Renseigner mon commerce</Link>
      </div>
    );
  const q = one(sp.q).slice(0, 80);
  const like = (s: string) => `%${s.replace(/[%_,()\\]/g, " ")}%`;
  const cardId = isId(one(sp.carte)) ? one(sp.carte) : null;
  const contactId = isId(one(sp.contact)) ? one(sp.contact) : null;

  const { data: program } = await supabase.from("loyalty_programs").select("*").eq("business_id", business.id).maybeSingle();
  let cardsQuery = supabase
    .from("loyalty_cards")
    .select("id, balance, rewards_redeemed, created_at, contacts!inner(id, first_name, last_name, email, phone)")
    .eq("business_id", business.id)
    .order("created_at", { ascending: false })
    .limit(100);
  if (q) cardsQuery = cardsQuery.or(`first_name.ilike.${like(q)},last_name.ilike.${like(q)},email.ilike.${like(q)},phone.ilike.${like(q)}`, { referencedTable: "contacts" });
  const [{ data: cards }, { count: total }, selected, preContact] = await Promise.all([
    cardsQuery,
    supabase.from("loyalty_cards").select("id", { count: "exact", head: true }).eq("business_id", business.id),
    cardId
      ? supabase.from("loyalty_cards").select("id, balance, total_earned, rewards_redeemed, public_code, created_at, contacts(id, first_name, last_name, email, phone)").eq("id", cardId).eq("business_id", business.id).maybeSingle()
      : Promise.resolve({ data: null }),
    contactId ? supabase.from("contacts").select("id, first_name, last_name, email, phone").eq("id", contactId).eq("business_id", business.id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const { data: events } = selected.data
    ? await supabase.from("loyalty_events").select("id, kind, amount, spend_cents, note, created_at").eq("card_id", selected.data.id).order("created_at", { ascending: false }).limit(30)
    : { data: [] };

  const manage = canManage(role);
  const cost = program ? (program.kind === "stamps" ? program.stamps_required : program.reward_threshold) : 0;
  const unit = program?.kind === "points" ? "points" : "tampons";
  type C = { id: string; first_name: string | null; last_name: string | null; email: string | null; phone: string | null };

  return (
    <div className="mt-4 space-y-6">
      <header className="flex items-start gap-4">
        <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-brand text-white"><Gift className="size-6" /></span>
        <div>
          <h1 className="text-2xl font-semibold sm:text-3xl">Fidélité</h1>
          <p className="mt-1 text-ink-soft">Une carte de fidélité sans papier : tampons ou points, récompenses, historique. Chaque client consulte sa carte depuis son téléphone.</p>
        </div>
      </header>

      {!program ? (
        <section className="card space-y-3 p-5">
          <h2 className="font-semibold">Créez votre programme</h2>
          {manage ? <ProgramForm program={null} /> : <p className="text-sm text-ink-soft">Le propriétaire ou un administrateur doit d&apos;abord créer le programme.</p>}
        </section>
      ) : (
        <>
          <p className="rounded-2xl border border-line bg-white px-4 py-3 text-sm">
            <span className="font-semibold">{program.active ? "Programme actif" : "Programme en pause"} : </span>
            {program.kind === "stamps"
              ? `${program.stamps_required} tampons = ${program.reward_label}.`
              : `${Number(program.points_per_euro).toLocaleString("fr-FR")} point(s) par euro, ${program.reward_threshold} points = ${program.reward_label}.`}{" "}
            {total ?? 0} carte(s).
          </p>

          {selected.data ? (
            <CardPanel
              card={{ ...selected.data, contact: selected.data.contacts as unknown as C }}
              contactName={displayName(selected.data.contacts as unknown as C)}
              program={{ kind: program.kind, cost, unit, reward: program.reward_label, active: program.active }}
              publicUrl={`${SITE_URL}/carte/${selected.data.public_code}`}
              events={(events ?? []).map((e) => ({ ...e, when: formatInstant(e.created_at, "full"), spend: e.spend_cents ? formatMoney(e.spend_cents) : null }))}
            />
          ) : null}

          {preContact.data && !selected.data ? (
            <section className="card flex flex-wrap items-center justify-between gap-3 p-5">
              <p className="text-sm">Créer une carte pour <span className="font-semibold">{displayName(preContact.data)}</span> ?</p>
              <CreateCardButton contactId={preContact.data.id} />
            </section>
          ) : null}

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
            <section className="card min-w-0 space-y-4 p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-semibold">Cartes</h2>
                <form action="/fidelite" className="relative">
                  <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-soft" />
                  <input name="q" defaultValue={q} placeholder="Rechercher un client" className="input py-2 pl-9" aria-label="Rechercher un client" />
                </form>
              </div>
              {(cards ?? []).length ? (
                <ul className="divide-y divide-line">
                  {(cards ?? []).map((c) => {
                    const contact = c.contacts as unknown as C;
                    const pct = cost ? Math.min(100, (c.balance / cost) * 100) : 0;
                    return (
                      <li key={c.id}>
                        <Link href={`/fidelite?carte=${c.id}`} className={`flex items-center gap-3 py-2.5 hover:bg-canvas ${cardId === c.id ? "bg-brand-soft" : ""}`}>
                          <span className="min-w-0 flex-1 truncate font-medium">{displayName(contact)}</span>
                          <span className="hidden h-2 w-28 overflow-hidden rounded-full bg-canvas sm:block"><span className="block h-full bg-brand" style={{ width: `${pct}%` }} /></span>
                          <span className="w-24 text-right text-sm">{c.balance} {unit}</span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="text-sm text-ink-soft">{q ? "Aucune carte ne correspond." : "Aucune carte pour le moment. Inscrivez votre premier client à droite."}</p>
              )}
            </section>
            <aside className="space-y-4">
              <section className="card space-y-3 p-5">
                <h2 className="font-semibold">Inscrire un client</h2>
                <EnrollForm />
              </section>
              {manage ? (
                <details className="card p-5">
                  <summary className="cursor-pointer font-semibold">Réglages du programme</summary>
                  <div className="mt-4"><ProgramForm program={program} /></div>
                </details>
              ) : null}
            </aside>
          </div>
        </>
      )}
    </div>
  );
}
