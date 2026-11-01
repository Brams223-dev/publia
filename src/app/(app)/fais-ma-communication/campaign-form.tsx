"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Sparkles } from "lucide-react";
import { createCampaign } from "./actions";
import { CAMPAIGN_PLATFORMS, DURATIONS, LIMITS, OBJECTIVES } from "@/lib/campaigns/config";

function Generate({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <>
      <button type="submit" className="btn-primary w-full py-3.5 text-base sm:w-auto sm:px-8" disabled={disabled || pending}>
        <Sparkles className="size-5" /> {pending ? "Publia prépare votre campagne…" : "Préparer ma campagne"}
      </button>
      {pending && (
        <div role="status" className="fixed inset-0 z-50 grid place-items-center bg-canvas/85 px-6 backdrop-blur-sm">
          <div className="card max-w-sm p-8 text-center">
            <span className="mx-auto grid size-14 animate-pulse place-items-center rounded-2xl bg-brand text-white">
              <Sparkles className="size-7" />
            </span>
            <p className="mt-5 text-lg font-semibold">Publia prépare votre campagne</p>
            <p className="mt-2 text-sm text-ink-soft">
              Rédaction des contenus, choix des hashtags et planification. Cela prend généralement 20 à 60 secondes.
            </p>
          </div>
        </div>
      )}
    </>
  );
}

const today = () => new Date().toISOString().slice(0, 10);

export function CampaignForm({ disabled, remaining }: { disabled: boolean; remaining: number }) {
  const [state, action] = useActionState(createCampaign, undefined);
  const [requestId] = useState(() => crypto.randomUUID());
  const [briefLength, setBriefLength] = useState(0);

  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="requestId" value={requestId} />

      <section className="card p-5 sm:p-6">
        <h2 className="font-semibold">1. Votre objectif</h2>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {OBJECTIVES.map((o, i) => (
            <label key={o.id} className="cursor-pointer">
              <input type="radio" name="objective" value={o.id} className="peer sr-only" defaultChecked={i === 0} required />
              <span className="flex h-full flex-col rounded-2xl border border-line bg-white p-4 transition peer-checked:border-brand peer-checked:bg-brand-soft peer-focus-visible:ring-2 peer-focus-visible:ring-brand/30">
                <span className="font-semibold">{o.label}</span>
                <span className="mt-0.5 text-sm text-ink-soft">{o.hint}</span>
              </span>
            </label>
          ))}
        </div>
      </section>

      <section className="card space-y-4 p-5 sm:p-6">
        <h2 className="font-semibold">2. Votre idée</h2>
        <div>
          <label htmlFor="brief" className="label">Décrivez ce que vous voulez communiquer *</label>
          <textarea
            id="brief"
            name="brief"
            rows={3}
            required
            minLength={LIMITS.briefMin}
            maxLength={LIMITS.briefMax}
            onChange={(e) => setBriefLength(e.target.value.length)}
            className="input resize-y"
            placeholder="Ex. : Je veux faire découvrir notre nouveau burger maison, préparé avec du pain de la boulangerie d'à côté."
          />
          <p className="mt-1 text-right text-xs text-ink-soft">{briefLength}/{LIMITS.briefMax}</p>
        </div>
        <div>
          <label htmlFor="facts" className="label">Informations à mentionner (facultatif)</label>
          <textarea
            id="facts"
            name="facts"
            rows={2}
            maxLength={LIMITS.factsMax}
            className="input resize-y"
            placeholder="Prix, dates, offre, conditions… Ex. : 12,90 € avec frites, disponible du 8 au 15 novembre."
          />
          <p className="mt-1 text-xs text-ink-soft">
            L&apos;IA n&apos;écrira aucun prix, aucune date ni aucune promotion qui ne figure pas ici ou dans votre profil.
          </p>
        </div>
      </section>

      <section className="card space-y-5 p-5 sm:p-6">
        <h2 className="font-semibold">3. Diffusion</h2>
        <fieldset>
          <legend className="label">Plateformes *</legend>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {CAMPAIGN_PLATFORMS.map((p) => (
              <label key={p.id} className="cursor-pointer">
                <input type="checkbox" name="platforms" value={p.id} className="peer sr-only" defaultChecked={p.id !== "youtube"} />
                <span className="block h-full rounded-xl border border-line bg-white px-3 py-2.5 transition peer-checked:border-brand peer-checked:bg-brand-soft peer-focus-visible:ring-2 peer-focus-visible:ring-brand/30">
                  <span className="block text-sm font-semibold">{p.label}</span>
                  <span className="block text-xs text-ink-soft">{p.detail}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        <div className="grid gap-4 sm:grid-cols-2">
          <fieldset>
            <legend className="label">Durée</legend>
            <div className="flex gap-2">
              {DURATIONS.map((d) => (
                <label key={d} className="flex-1 cursor-pointer">
                  <input type="radio" name="duration" value={d} className="peer sr-only" defaultChecked={d === 7} />
                  <span className="block rounded-xl border border-line bg-white px-3 py-2.5 text-center text-sm transition peer-checked:border-brand peer-checked:bg-brand-soft peer-checked:font-semibold peer-checked:text-brand">
                    {d === 7 ? "1 semaine" : "2 semaines"}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          <div>
            <label htmlFor="startDate" className="label">Début de la campagne</label>
            <input id="startDate" name="startDate" type="date" className="input" defaultValue={today()} min={today()} required />
          </div>
        </div>
      </section>

      <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
        <Generate disabled={disabled} />
        <p className="text-sm text-ink-soft">
          Utilise 1 génération · {remaining} restante{remaining > 1 ? "s" : ""} ce mois-ci
        </p>
      </div>
      {state?.error && (
        <p role="alert" className="rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">
          {state.error}
        </p>
      )}
    </form>
  );
}
