import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Gift, MessageSquare, Star } from "lucide-react";
import { getCurrentBusiness } from "@/lib/business";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { displayName } from "@/lib/contacts";
import { formatInstant } from "@/lib/format";
import { ContactForm } from "../contact-form";
import { DeleteContact } from "./delete-contact";

export const metadata: Metadata = { title: "Contact" };

export default async function ContactPage({ params }: { params: Promise<{ id: string }> }) {
  if (!isSupabaseConfigured()) return null;
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { supabase, business } = await getCurrentBusiness();
  if (!business) notFound();
  const { data: c } = await supabase.from("contacts").select("*").eq("id", id).eq("business_id", business.id).maybeSingle();
  if (!c) notFound();

  const [{ data: messages }, { data: reviews }, { data: card }] = await Promise.all([
    supabase.from("inbox_messages").select("id, subject, body, created_at, status").eq("contact_id", id).order("created_at", { ascending: false }).limit(10),
    supabase.from("reviews").select("id, rating, comment, status, created_at").eq("contact_id", id).order("created_at", { ascending: false }).limit(10),
    supabase.from("loyalty_cards").select("id, balance, rewards_redeemed").eq("contact_id", id).maybeSingle(),
  ]);

  return (
    <div className="mt-4 space-y-6">
      <header>
        <Link href="/contacts" className="text-sm text-ink-soft hover:text-brand">← Contacts</Link>
        <h1 className="mt-2 truncate text-2xl font-semibold sm:text-3xl">{displayName(c)}</h1>
        <p className="mt-1 text-sm text-ink-soft">Ajouté le {formatInstant(c.created_at, "dayMonthYear")}</p>
      </header>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <section className="card min-w-0 p-5">
          <ContactForm
            values={{
              id: c.id,
              first_name: c.first_name ?? "",
              last_name: c.last_name ?? "",
              email: c.email ?? "",
              phone: c.phone ?? "",
              tags: (c.tags as string[]).join(", "),
              notes: c.notes ?? "",
              marketing_consent: c.marketing_consent,
              consent_source: c.consent_source ?? "",
              consent_label: c.marketing_consent && c.consent_at ? `Accord recueilli le ${formatInstant(c.consent_at, "dayMonthYear")} — ${c.consent_source ?? ""}` : null,
            }}
          />
        </section>

        <aside className="space-y-4">
          <div className="card space-y-2 p-4">
            <p className="flex items-center gap-2 font-semibold"><Gift className="size-4 text-brand" /> Fidélité</p>
            {card ? (
              <>
                <p className="text-sm">Solde : <span className="font-semibold">{card.balance}</span> · {card.rewards_redeemed} récompense(s) utilisée(s)</p>
                <Link href={`/fidelite?carte=${card.id}`} className="btn-ghost w-full">Ouvrir la carte</Link>
              </>
            ) : (
              <Link href={`/fidelite?contact=${c.id}`} className="btn-ghost w-full">Créer une carte de fidélité</Link>
            )}
          </div>
          <div className="card space-y-2 p-4">
            <p className="flex items-center gap-2 font-semibold"><MessageSquare className="size-4 text-brand" /> Messages</p>
            {messages?.length ? (
              <ul className="space-y-2 text-sm">
                {messages.map((m) => (
                  <li key={m.id}>
                    <Link href={`/inbox?message=${m.id}`} className="block rounded-lg p-2 hover:bg-canvas">
                      <span className="block truncate font-medium">{m.subject || m.body.slice(0, 60)}</span>
                      <span className="text-xs text-ink-soft">{formatInstant(m.created_at, "full")}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : <p className="text-sm text-ink-soft">Aucun message.</p>}
          </div>
          <div className="card space-y-2 p-4">
            <p className="flex items-center gap-2 font-semibold"><Star className="size-4 text-brand" /> Avis</p>
            {reviews?.length ? (
              <ul className="space-y-2 text-sm">
                {reviews.map((r) => (
                  <li key={r.id} className="rounded-lg p-2">
                    <span className="font-medium">{"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)}</span>
                    {r.comment ? <span className="block text-ink-soft">{r.comment.slice(0, 120)}</span> : null}
                  </li>
                ))}
              </ul>
            ) : <p className="text-sm text-ink-soft">Aucun avis.</p>}
          </div>
          <DeleteContact id={c.id} />
        </aside>
      </div>
    </div>
  );
}
