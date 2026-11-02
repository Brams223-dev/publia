"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import { saveContact, type FormState } from "./actions";

export type ContactValues = {
  id?: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  tags: string;
  notes: string;
  marketing_consent: boolean;
  consent_source: string;
  consent_label?: string | null;
};

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button className="btn-primary" disabled={pending}>
      {pending ? <Loader2 className="size-4 animate-spin" /> : null} {label}
    </button>
  );
}

export function ContactForm({ values, onCancel }: { values: ContactValues; onCancel?: () => void }) {
  const [state, action] = useActionState<FormState, FormData>(saveContact, undefined);
  const [consent, setConsent] = useState(values.marketing_consent);
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      {values.id ? <input type="hidden" name="id" value={values.id} /> : null}
      <div>
        <label className="label" htmlFor="first_name">Prénom</label>
        <input id="first_name" name="first_name" maxLength={80} defaultValue={values.first_name} className="input" autoComplete="off" />
      </div>
      <div>
        <label className="label" htmlFor="last_name">Nom</label>
        <input id="last_name" name="last_name" maxLength={80} defaultValue={values.last_name} className="input" autoComplete="off" />
      </div>
      <div>
        <label className="label" htmlFor="email">E-mail</label>
        <input id="email" name="email" type="email" maxLength={254} defaultValue={values.email} className="input" autoComplete="off" />
      </div>
      <div>
        <label className="label" htmlFor="phone">Téléphone</label>
        <input id="phone" name="phone" maxLength={40} defaultValue={values.phone} className="input" autoComplete="off" />
      </div>
      <div className="sm:col-span-2">
        <label className="label" htmlFor="tags">Étiquettes (séparées par des virgules)</label>
        <input id="tags" name="tags" defaultValue={values.tags} className="input" placeholder="vip, mariage 2026, client fidèle" />
      </div>
      <div className="sm:col-span-2">
        <label className="label" htmlFor="notes">Notes internes</label>
        <textarea id="notes" name="notes" rows={3} maxLength={2000} defaultValue={values.notes} className="input" />
      </div>
      <div className="space-y-2 rounded-xl border border-line p-3 sm:col-span-2">
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" name="consent" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 size-4 accent-brand" />
          <span>
            <span className="font-medium">Ce client accepte de recevoir mes offres</span>
            <span className="block text-xs text-ink-soft">Cochez uniquement si le client a donné son accord explicite (RGPD). Il peut le retirer à tout moment.</span>
          </span>
        </label>
        {consent && !values.marketing_consent ? (
          <div>
            <label className="label" htmlFor="consent_source">Comment a-t-il donné son accord ?</label>
            <input id="consent_source" name="consent_source" required maxLength={120} defaultValue="" className="input" placeholder="Ex. : formulaire signé en boutique le 2 novembre" />
          </div>
        ) : (
          <input type="hidden" name="consent_source" value={values.consent_source} />
        )}
        {values.consent_label && consent ? <p className="text-xs text-ink-soft">{values.consent_label}</p> : null}
      </div>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <Submit label={values.id ? "Enregistrer" : "Créer le contact"} />
        {onCancel ? <button type="button" className="btn-ghost" onClick={onCancel}>Annuler</button> : null}
        {state?.error ? <p className="text-sm text-danger">{state.error}</p> : null}
        {state?.success ? <p className="text-sm text-success">{state.success}</p> : null}
      </div>
    </form>
  );
}
