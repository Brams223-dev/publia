import type { Metadata } from "next";
import Link from "next/link";
import { Inbox, Mail, Phone, UserRound } from "lucide-react";
import { getCurrentBusiness } from "@/lib/business";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { formatInstant } from "@/lib/format";
import { MessageActions } from "./message-actions";

export const metadata: Metadata = { title: "Inbox" };

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
const TABS = { new: "Non lus", read: "Lus", archived: "Archivés" } as const;

export default async function InboxPage({ searchParams }: { searchParams: Promise<SP> }) {
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

  const selectedId = one(sp.message);
  let selected: { id: string; name: string; email: string | null; phone: string | null; subject: string | null; body: string; status: string; created_at: string; contact_id: string | null } | null = null;
  if (/^[0-9a-f-]{36}$/i.test(selectedId)) {
    const { data } = await supabase.from("inbox_messages").select("id, name, email, phone, subject, body, status, created_at, contact_id").eq("id", selectedId).eq("business_id", business.id).maybeSingle();
    selected = data;
    if (selected?.status === "new") {
      await supabase.from("inbox_messages").update({ status: "read" }).eq("id", selected.id);
      selected.status = "read";
    }
  }
  const tab = (one(sp.tab) in TABS ? one(sp.tab) : selected?.status === "archived" ? "archived" : "new") as keyof typeof TABS;
  const [{ data: list }, { count: unread }, { data: shop }] = await Promise.all([
    supabase.from("inbox_messages").select("id, name, subject, body, status, created_at").eq("business_id", business.id).eq("status", tab).order("created_at", { ascending: false }).limit(100),
    supabase.from("inbox_messages").select("id", { count: "exact", head: true }).eq("business_id", business.id).eq("status", "new"),
    supabase.from("shops").select("published, settings").eq("business_id", business.id).maybeSingle(),
  ]);
  const formOn = Boolean(shop?.published && (shop.settings as { show_contact_form?: boolean } | null)?.show_contact_form !== false);
  const reply = selected?.email
    ? `mailto:${selected.email}?subject=${encodeURIComponent(`Re : ${selected.subject || `votre message à ${business.name}`}`)}&body=${encodeURIComponent(`Bonjour ${selected.name},\n\n\n\n— ${business.name}`)}`
    : null;

  return (
    <div className="mt-4 space-y-6">
      <header className="flex items-start gap-4">
        <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-brand text-white"><Inbox className="size-6" /></span>
        <div>
          <h1 className="text-2xl font-semibold sm:text-3xl">Inbox</h1>
          <p className="mt-1 text-ink-soft">Les messages envoyés depuis votre mini-site.</p>
        </div>
      </header>

      {!formOn ? (
        <p className="rounded-2xl border border-line bg-white px-4 py-3 text-sm text-ink-soft">
          Pour recevoir des messages, publiez votre <Link href="/mini-site" className="font-medium text-brand hover:underline">mini-site</Link> avec le formulaire de contact.
          Les messages Instagram, Facebook et WhatsApp arriveront ici une fois les comptes connectés (accès officiels en cours).
        </p>
      ) : null}

      <nav className="flex gap-2 text-sm">
        {(Object.keys(TABS) as (keyof typeof TABS)[]).map((k) => (
          <Link key={k} href={`/inbox?tab=${k}`} className={`rounded-full px-4 py-2 font-medium ${tab === k ? "bg-brand text-white" : "border border-line bg-white text-ink-soft hover:text-brand"}`}>
            {TABS[k]}{k === "new" && unread ? ` (${unread})` : ""}
          </Link>
        ))}
      </nav>

      <div className="grid gap-6 lg:grid-cols-[20rem_minmax(0,1fr)]">
        <ul className="card max-h-[70vh] divide-y divide-line overflow-y-auto">
          {(list ?? []).length === 0 ? <li className="p-6 text-center text-sm text-ink-soft">Aucun message.</li> : null}
          {(list ?? []).map((m) => (
            <li key={m.id}>
              <Link href={`/inbox?tab=${tab}&message=${m.id}`} className={`block px-4 py-3 hover:bg-canvas ${selected?.id === m.id ? "bg-brand-soft" : ""}`}>
                <span className={`block truncate ${m.status === "new" ? "font-semibold" : ""}`}>{m.name}</span>
                <span className="block truncate text-sm text-ink-soft">{m.subject || m.body}</span>
                <span className="text-xs text-ink-soft">{formatInstant(m.created_at, "full")}</span>
              </Link>
            </li>
          ))}
        </ul>

        {selected ? (
          <article className="card min-w-0 space-y-4 p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="truncate text-lg font-semibold">{selected.subject || "Message"}</h2>
                <p className="text-sm text-ink-soft">{selected.name} · {formatInstant(selected.created_at, "full")}</p>
              </div>
              <MessageActions id={selected.id} status={selected.status as "new" | "read" | "archived"} />
            </div>
            <p className="whitespace-pre-line text-sm">{selected.body}</p>
            <div className="flex flex-wrap gap-2 border-t border-line pt-4">
              {reply ? <a href={reply} className="btn-primary"><Mail className="size-4" /> Répondre par e-mail</a> : null}
              {selected.phone ? <a href={`tel:${selected.phone}`} className="btn-ghost"><Phone className="size-4" /> {selected.phone}</a> : null}
              {selected.contact_id ? <Link href={`/contacts/${selected.contact_id}`} className="btn-ghost"><UserRound className="size-4" /> Fiche contact</Link> : null}
            </div>
            <p className="text-xs text-ink-soft">La réponse s&apos;ouvre dans votre messagerie. L&apos;envoi directement depuis Publia arrivera avec le service d&apos;e-mails.</p>
          </article>
        ) : (
          <div className="card grid place-items-center p-10 text-sm text-ink-soft">Sélectionnez un message.</div>
        )}
      </div>
    </div>
  );
}
