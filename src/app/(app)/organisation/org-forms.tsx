"use client";

import { useActionState, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { Check, Loader2, Plus, Store } from "lucide-react";
import { createBusiness, renameOrganization, switchBusiness, type FormState } from "./actions";

function Submit({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <button className="btn-primary" disabled={pending}>
      {pending ? <Loader2 className="size-4 animate-spin" /> : null} {children}
    </button>
  );
}

export function OrgNameForm({ name }: { name: string }) {
  const [state, action] = useActionState<FormState, FormData>(renameOrganization, undefined);
  return (
    <form action={action} className="card flex flex-wrap items-end gap-3 p-5">
      <div className="min-w-[14rem] flex-1">
        <label className="label" htmlFor="org-name">Nom de l&apos;organisation</label>
        <input id="org-name" name="name" required maxLength={120} defaultValue={name} className="input" />
      </div>
      <Submit>Enregistrer</Submit>
      {state?.error ? <p className="w-full text-sm text-danger">{state.error}</p> : null}
      {state?.ok ? <p className="w-full text-sm text-success">Nom enregistré.</p> : null}
    </form>
  );
}

export function BusinessesPanel({
  organizationId,
  currentId,
  businesses,
  canAdd,
  max,
  sectors,
}: {
  organizationId: string;
  currentId: string;
  businesses: { id: string; name: string }[];
  canAdd: boolean;
  max: number;
  sectors: string[];
}) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [state, action] = useActionState<FormState, FormData>(createBusiness, undefined);
  const full = businesses.length >= max;

  return (
    <section className="card space-y-4 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-semibold"><Store className="size-4 text-brand" /> Commerces</h2>
        <span className="text-sm text-ink-soft">{businesses.length} / {max} avec votre offre</span>
      </div>
      <ul className="divide-y divide-line">
        {businesses.map((b) => (
          <li key={b.id} className="flex items-center justify-between gap-3 py-2.5">
            <span className="min-w-0 truncate font-medium">{b.name}</span>
            {b.id === currentId ? (
              <span className="flex items-center gap-1 text-sm text-success"><Check className="size-4" /> Commerce actif</span>
            ) : (
              <button type="button" className="btn-ghost px-3 py-1.5 text-xs" disabled={pending} onClick={() => start(async () => { await switchBusiness(b.id); })}>
                Travailler sur ce commerce
              </button>
            )}
          </li>
        ))}
      </ul>
      {canAdd ? (
        full ? (
          <p className="text-sm text-ink-soft">Pour gérer plus de commerces, passez à une offre supérieure (Pro : 3 commerces, Business : 10).</p>
        ) : open ? (
          <form action={action} className="grid gap-3 rounded-xl border border-line p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <input type="hidden" name="organizationId" value={organizationId} />
            <div>
              <label className="label" htmlFor="new-name">Nom du commerce</label>
              <input id="new-name" name="name" required maxLength={120} className="input" />
            </div>
            <div>
              <label className="label" htmlFor="new-category">Secteur</label>
              <select id="new-category" name="category" required defaultValue="" className="input">
                <option value="" disabled>Choisir…</option>
                {sectors.map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
            <Submit>Créer</Submit>
            {state?.error ? <p className="text-sm text-danger sm:col-span-3">{state.error}</p> : null}
          </form>
        ) : (
          <button type="button" className="btn-ghost" onClick={() => setOpen(true)}><Plus className="size-4" /> Ajouter un commerce</button>
        )
      ) : null}
    </section>
  );
}
