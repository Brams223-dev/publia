"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { saveBusiness, type SaveState } from "./actions";
import { DEFAULT_COLORS, SECTORS, TONES, type BrandColors } from "@/lib/config/business";
import type { Business } from "@/lib/business";

function Save({ isNew }: { isNew: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary px-6 py-3" disabled={pending}>
      {pending ? "Enregistrement…" : isNew ? "Créer mon commerce" : "Enregistrer"}
    </button>
  );
}

function Err({ state, name }: { state: SaveState; name: string }) {
  const msg = state?.fieldErrors?.[name];
  return msg ? <p className="mt-1 text-sm text-danger">{msg}</p> : null;
}

const COLOR_FIELDS: { key: keyof BrandColors; label: string }[] = [
  { key: "primary", label: "Couleur principale" },
  { key: "secondary", label: "Couleur secondaire" },
  { key: "text", label: "Couleur du texte" },
];

export function BusinessForm({ business, logoUrl }: { business: Business | null; logoUrl: string | null }) {
  const [state, action] = useActionState(saveBusiness, undefined);
  const [colors, setColors] = useState<BrandColors>(business?.brand_colors ?? DEFAULT_COLORS);
  const [name, setName] = useState(business?.name ?? "");

  return (
    <form action={action} className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="space-y-6">
        <section className="card space-y-4 p-5 sm:p-6">
          <h2 className="font-semibold">Informations</h2>
          <div>
            <label htmlFor="name" className="label">Nom du commerce *</label>
            <input id="name" name="name" className="input" required maxLength={120} value={name} onChange={(e) => setName(e.target.value)} />
            <Err state={state} name="name" />
          </div>
          <div>
            <label htmlFor="category" className="label">Secteur d&apos;activité *</label>
            <select id="category" name="category" className="input" required defaultValue={business?.category ?? ""}>
              <option value="" disabled>Choisir…</option>
              {SECTORS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <Err state={state} name="category" />
          </div>
          <div>
            <label htmlFor="description" className="label">Description</label>
            <textarea
              id="description"
              name="description"
              rows={4}
              maxLength={2000}
              className="input resize-y"
              placeholder="Ce que vous proposez, ce qui vous rend unique. L'IA s'appuiera sur ce texte, sans rien inventer."
              defaultValue={business?.description ?? ""}
            />
            <Err state={state} name="description" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="address" className="label">Adresse</label>
              <input id="address" name="address" className="input" autoComplete="street-address" defaultValue={business?.address ?? ""} />
            </div>
            <div>
              <label htmlFor="city" className="label">Ville</label>
              <input id="city" name="city" className="input" autoComplete="address-level2" defaultValue={business?.city ?? ""} />
            </div>
            <div>
              <label htmlFor="phone" className="label">Téléphone</label>
              <input id="phone" name="phone" type="tel" className="input" autoComplete="tel" defaultValue={business?.phone ?? ""} />
              <Err state={state} name="phone" />
            </div>
            <div>
              <label htmlFor="website" className="label">Site internet</label>
              <input id="website" name="website" className="input" inputMode="url" placeholder="www.exemple.fr" defaultValue={business?.website ?? ""} />
              <Err state={state} name="website" />
            </div>
          </div>
        </section>

        <section className="card space-y-4 p-5 sm:p-6">
          <div>
            <h2 className="font-semibold">Votre activité en détail</h2>
            <p className="mt-1 text-sm text-ink-soft">Ces informations alimentent toutes les fonctions IA de Publia.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="products" className="label">Produits phares</label>
              <textarea id="products" name="products" rows={3} maxLength={2000} className="input resize-y" placeholder="Ex. : burgers maison, frites fraîches, desserts du jour" defaultValue={business?.products ?? ""} />
            </div>
            <div>
              <label htmlFor="services" className="label">Services</label>
              <textarea id="services" name="services" rows={3} maxLength={2000} className="input resize-y" placeholder="Ex. : sur place, à emporter, livraison, privatisation" defaultValue={business?.services ?? ""} />
            </div>
            <div>
              <label htmlFor="target_audience" className="label">Clientèle visée</label>
              <textarea id="target_audience" name="target_audience" rows={2} maxLength={1000} className="input resize-y" placeholder="Ex. : familles et salariés du quartier" defaultValue={business?.target_audience ?? ""} />
            </div>
            <div>
              <label htmlFor="opening_hours" className="label">Horaires</label>
              <textarea id="opening_hours" name="opening_hours" rows={2} maxLength={500} className="input resize-y" placeholder="Ex. : du mardi au samedi, 11 h 30 – 14 h 30 et 18 h 30 – 22 h" defaultValue={business?.opening_hours ?? ""} />
            </div>
          </div>
          <div>
            <label htmlFor="goals" className="label">Vos objectifs</label>
            <textarea id="goals" name="goals" rows={2} maxLength={1000} className="input resize-y" placeholder="Ex. : remplir le service du midi en semaine, faire connaître la livraison" defaultValue={business?.goals ?? ""} />
          </div>
          <div>
            <p className="label">Réseaux sociaux</p>
            <div className="grid gap-3 sm:grid-cols-2">
              {(["instagram", "facebook", "tiktok", "youtube"] as const).map((n) => (
                <input
                  key={n}
                  name={`social_${n}`}
                  aria-label={n}
                  maxLength={200}
                  className="input"
                  placeholder={{ instagram: "Instagram (@moncommerce)", facebook: "Page Facebook", tiktok: "TikTok (@moncommerce)", youtube: "Chaîne YouTube" }[n]}
                  defaultValue={business?.social_links?.[n] ?? ""}
                />
              ))}
            </div>
          </div>
        </section>

        <section className="card space-y-4 p-5 sm:p-6">
          <h2 className="font-semibold">Ton de communication *</h2>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {TONES.map((t) => (
              <label key={t.id} className="cursor-pointer">
                <input type="radio" name="tone" value={t.id} className="peer sr-only" defaultChecked={(business?.tone ?? "chaleureux") === t.id} />
                <span className="block rounded-xl border border-line bg-white px-3 py-2.5 text-center text-sm transition peer-checked:border-brand peer-checked:bg-brand-soft peer-checked:font-semibold peer-checked:text-brand peer-focus-visible:ring-2 peer-focus-visible:ring-brand/30">
                  {t.label}
                </span>
              </label>
            ))}
          </div>
          <Err state={state} name="tone" />
        </section>

        <section className="card space-y-4 p-5 sm:p-6">
          <h2 className="font-semibold">Couleurs de marque</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            {COLOR_FIELDS.map(({ key, label }) => (
              <div key={key}>
                <label htmlFor={key} className="label">{label}</label>
                <div className="flex items-center gap-2 rounded-xl border border-line bg-white p-1.5">
                  <input
                    id={key}
                    type="color"
                    name={key}
                    value={colors[key]}
                    onChange={(e) => setColors((c) => ({ ...c, [key]: e.target.value }))}
                    className="size-9 cursor-pointer rounded-lg border-0 bg-transparent p-0"
                  />
                  <span className="font-mono text-sm uppercase text-ink-soft">{colors[key]}</span>
                </div>
              </div>
            ))}
          </div>
          <button type="button" className="text-sm font-medium text-brand hover:underline" onClick={() => setColors(DEFAULT_COLORS)}>
            Revenir aux couleurs Publia
          </button>
        </section>

        <div className="flex flex-wrap items-center gap-4">
          <Save isNew={!business} />
          {state?.error && <p role="alert" className="text-sm text-danger">{state.error}</p>}
          {state?.success && <p role="status" className="text-sm text-success">{state.success}</p>}
        </div>
      </div>

      {/* Aperçu en direct des couleurs */}
      <aside className="lg:sticky lg:top-8 lg:self-start">
        <p className="mb-2 text-sm font-medium text-ink-soft">Aperçu de vos couleurs</p>
        <div className="card overflow-hidden p-3">
          <div className="flex aspect-square flex-col rounded-2xl p-5" style={{ background: colors.primary, color: "#fff" }}>
            <div className="flex items-center justify-between">
              <span className="rounded-full px-3 py-1 text-[11px] font-semibold uppercase" style={{ background: colors.secondary }}>
                Nouveauté
              </span>
              {logoUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoUrl} alt="" className="size-10 rounded-lg bg-white object-contain p-1" />
              )}
            </div>
            <p className="mt-auto text-2xl font-bold leading-tight">{name || "Votre commerce"}</p>
            <span className="mt-3 self-start rounded-full bg-white px-4 py-2 text-sm font-semibold" style={{ color: colors.text }}>
              Découvrir
            </span>
          </div>
        </div>
        <p className="mt-2 text-xs text-ink-soft">Ces couleurs seront appliquées par défaut à vos visuels et miniatures.</p>
      </aside>
    </form>
  );
}
