"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Copy, Loader2 } from "lucide-react";
import type { SiteSettings } from "@/lib/minisite";
import { saveMiniSite, type FormState } from "./actions";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button className="btn-primary" disabled={pending}>
      {pending ? <Loader2 className="size-4 animate-spin" /> : null} Enregistrer
    </button>
  );
}

const SECTIONS: [keyof SiteSettings, string][] = [
  ["show_catalogue", "Afficher mes produits actifs"],
  ["show_reviews", "Afficher les avis et permettre d'en déposer"],
  ["show_contact_form", "Formulaire de contact (messages dans l'Inbox)"],
  ["show_hours", "Afficher les horaires"],
  ["show_phone", "Afficher le téléphone"],
  ["show_address", "Afficher l'adresse et l'itinéraire"],
];

export function MiniSiteForm({ values, siteUrlPrefix, disabled }: { values: { slug: string; name: string; published: boolean; settings: SiteSettings }; siteUrlPrefix: string; disabled: boolean }) {
  const [state, action] = useActionState<FormState, FormData>(saveMiniSite, undefined);
  const [slug, setSlug] = useState(values.slug);
  const [copied, setCopied] = useState(false);
  const s = values.settings;

  return (
    <form action={action} className="space-y-6">
      <fieldset disabled={disabled} className="min-w-0 space-y-6">
        <section className="card space-y-4 p-5">
          <h2 className="font-semibold">Adresse et publication</h2>
          <div>
            <label className="label" htmlFor="slug">Adresse de votre page</label>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-ink-soft">{siteUrlPrefix}</span>
              <input id="slug" name="slug" required value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))} maxLength={60} className="input w-auto min-w-[12rem] flex-1" />
              <button type="button" className="btn-ghost px-3" onClick={async () => { await navigator.clipboard.writeText(siteUrlPrefix + slug); setCopied(true); }}>
                <Copy className="size-4" /> {copied ? "Copié" : "Copier"}
              </button>
            </div>
          </div>
          <div>
            <label className="label" htmlFor="name">Nom affiché (facultatif, sinon celui du commerce)</label>
            <input id="name" name="name" defaultValue={values.name} maxLength={80} className="input" />
          </div>
          <label className="flex items-start gap-2 rounded-xl bg-brand-soft p-3 text-sm">
            <input type="checkbox" name="published" defaultChecked={values.published} className="mt-0.5 size-4 accent-brand" />
            <span><span className="font-medium">Mettre le mini-site en ligne</span><span className="block text-xs text-ink-soft">Visible par tous et référençable par les moteurs de recherche.</span></span>
          </label>
        </section>

        <section className="card space-y-4 p-5">
          <h2 className="font-semibold">Contenu</h2>
          <div>
            <label className="label" htmlFor="headline">Accroche</label>
            <input id="headline" name="headline" defaultValue={s.headline} maxLength={120} className="input" placeholder="Ex. : Fleuriste artisanal au cœur du 11e depuis 1998" />
          </div>
          <div>
            <label className="label" htmlFor="about">Présentation (sinon, la description de « Mon commerce »)</label>
            <textarea id="about" name="about" defaultValue={s.about} rows={5} maxLength={1500} className="input" />
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {SECTIONS.map(([key, label]) => (
              <label key={key} className="flex items-center gap-2 text-sm">
                <input type="checkbox" name={key} defaultChecked={Boolean(s[key])} className="size-4 accent-brand" /> {label}
              </label>
            ))}
          </div>
        </section>

        <section className="card space-y-3 p-5">
          <h2 className="font-semibold">Avis Google (facultatif)</h2>
          <p className="text-sm text-ink-soft">
            Après avoir déposé un avis sur votre mini-site, chaque client, quelle que soit sa note, se verra proposer de le publier aussi sur
            Google. Filtrer les avis selon la note est interdit par Google et par le droit de la consommation.
          </p>
          <input id="google_review_url" name="google_review_url" defaultValue={s.google_review_url} maxLength={300} className="input" placeholder="https://g.page/r/…/review" aria-label="Lien vers vos avis Google" />
        </section>
      </fieldset>

      {disabled ? (
        <p className="text-sm text-ink-soft">Seuls le propriétaire et les administrateurs peuvent modifier le mini-site.</p>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <Submit />
          {state?.error ? <p className="text-sm text-danger">{state.error}</p> : null}
          {state?.success ? <p className="text-sm text-success">{state.success}</p> : null}
        </div>
      )}
    </form>
  );
}
