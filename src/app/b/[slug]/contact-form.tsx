"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Loader2, Send } from "lucide-react";
import { sendMessage, type PublicFormState } from "./actions";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button className="btn-primary" style={{ background: "var(--site-primary)" }} disabled={pending}>
      {pending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />} Envoyer
    </button>
  );
}

export function ContactForm({ slug, businessName }: { slug: string; businessName: string }) {
  const [state, action] = useActionState<PublicFormState, FormData>(sendMessage, undefined);
  if (state?.success) return <p className="rounded-xl bg-success/10 p-4 text-sm text-success">{state.success}</p>;
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2">
      <input type="hidden" name="slug" value={slug} />
      <div className="hidden" aria-hidden>
        <label htmlFor="website">Ne pas remplir</label>
        <input id="website" name="website" tabIndex={-1} autoComplete="off" />
      </div>
      <div className="sm:col-span-2">
        <label className="label" htmlFor="name">Votre nom</label>
        <input id="name" name="name" required minLength={2} maxLength={120} className="input" autoComplete="name" />
      </div>
      <div>
        <label className="label" htmlFor="email">E-mail</label>
        <input id="email" name="email" type="email" maxLength={254} className="input" autoComplete="email" />
      </div>
      <div>
        <label className="label" htmlFor="phone">Téléphone</label>
        <input id="phone" name="phone" maxLength={40} className="input" autoComplete="tel" />
      </div>
      <div className="sm:col-span-2">
        <label className="label" htmlFor="subject">Objet (facultatif)</label>
        <input id="subject" name="subject" maxLength={150} className="input" />
      </div>
      <div className="sm:col-span-2">
        <label className="label" htmlFor="body">Message</label>
        <textarea id="body" name="body" required minLength={5} maxLength={3000} rows={5} className="input" />
      </div>
      <label className="flex items-start gap-2 text-sm sm:col-span-2">
        <input type="checkbox" name="marketing" className="mt-0.5 size-4" />
        <span>J&apos;accepte de recevoir les offres et actualités de {businessName}. Désinscription possible à tout moment.</span>
      </label>
      <p className="text-xs text-ink-soft sm:col-span-2">
        Vos coordonnées sont transmises uniquement à {businessName} pour vous répondre. Vous pouvez demander leur suppression en le contactant.
      </p>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <Submit />
        {state?.error ? <p className="text-sm text-danger">{state.error}</p> : null}
      </div>
    </form>
  );
}
