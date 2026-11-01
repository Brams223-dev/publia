"use client";

import { useActionState, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import { createAdCampaign } from "../actions";
import { AD_OBJECTIVES, AD_PLATFORMS, type AdPlatform } from "@/lib/ads/config";
import { checkBudget, euros } from "@/lib/ads/budget";

export type WizardCreation = { id: string; title: string | null; url: string | null };

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="card p-5 sm:p-6">
      <h2 className="flex items-center gap-2 font-semibold">
        <span className="grid size-6 place-items-center rounded-full bg-brand text-xs text-white">{n}</span> {title}
      </h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Submit({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <>
      <button type="submit" disabled={disabled || pending} className="btn-primary w-full py-3.5 text-base sm:w-auto sm:px-8">
        <Sparkles className="size-5" /> {pending ? "Génération des créations…" : "Générer les créations et le ciblage"}
      </button>
      {pending && (
        <div role="status" className="fixed inset-0 z-50 grid place-items-center bg-canvas/85 px-6 backdrop-blur-sm">
          <div className="card max-w-sm p-8 text-center">
            <span className="mx-auto grid size-14 animate-pulse place-items-center rounded-2xl bg-brand text-white"><Sparkles className="size-7" /></span>
            <p className="mt-5 text-lg font-semibold">Publia prépare votre publicité</p>
            <p className="mt-2 text-sm text-ink-soft">Variantes de textes, appels à l&apos;action et proposition de ciblage. 20 à 60 secondes environ.</p>
          </div>
        </div>
      )}
    </>
  );
}

const iso = (d: Date) => d.toISOString().slice(0, 10);

export function AdWizard({
  creations,
  defaultCity,
  defaultUrl,
  disabled,
  remaining,
  preselectedCreation,
}: {
  creations: WizardCreation[];
  defaultCity: string;
  defaultUrl: string;
  disabled: boolean;
  remaining: number;
  preselectedCreation: string | null;
}) {
  const [state, action] = useActionState(createAdCampaign, undefined);
  const [requestId] = useState(() => crypto.randomUUID());
  const [platform, setPlatform] = useState<AdPlatform>("meta");
  const cfg = AD_PLATFORMS.find((p) => p.id === platform)!;
  const [objective, setObjective] = useState<string>(cfg.objectives[0]);
  const [creationId, setCreationId] = useState<string>(preselectedCreation ?? "");
  const [today] = useState(() => iso(new Date()));
  const [start, setStart] = useState(today);
  const [end, setEnd] = useState(() => iso(new Date(Date.now() + 6 * 86_400_000)));
  const [daily, setDaily] = useState("5");
  const [cap, setCap] = useState("");

  const budget = useMemo(() => {
    const d = Math.round(Number(daily.replace(",", ".")) * 100);
    const days = Math.round((Date.parse(end) - Date.parse(start)) / 86_400_000) + 1;
    const planned = d * Math.max(days, 0);
    const c = cap ? Math.round(Number(cap.replace(",", ".")) * 100) : planned;
    return { check: checkBudget({ dailyCents: d, capCents: c, start, end, today }), planned, capCents: c, days };
  }, [daily, cap, start, end, today]);

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="requestId" value={requestId} />
      <input type="hidden" name="cap" value={(budget.capCents / 100).toFixed(2)} />

      <Step n={1} title="Réseau publicitaire">
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
          {AD_PLATFORMS.map((p) => (
            <label key={p.id} className="cursor-pointer">
              <input
                type="radio"
                name="platform"
                value={p.id}
                checked={platform === p.id}
                onChange={() => {
                  setPlatform(p.id);
                  if (!p.objectives.includes(objective as never)) setObjective(p.objectives[0]);
                }}
                className="peer sr-only"
              />
              <span className="block h-full rounded-xl border border-line bg-white p-3 transition peer-checked:border-brand peer-checked:bg-brand-soft">
                <span className="block text-sm font-semibold">{p.name}</span>
                <span className="block text-xs text-ink-soft">{p.detail}</span>
              </span>
            </label>
          ))}
        </div>
      </Step>

      <Step n={2} title="Objectif">
        <div className="flex flex-wrap gap-2">
          {cfg.objectives.map((o) => (
            <label key={o} className="cursor-pointer">
              <input type="radio" name="objective" value={o} checked={objective === o} onChange={() => setObjective(o)} className="peer sr-only" />
              <span className="block rounded-full border border-line bg-white px-4 py-2 text-sm transition peer-checked:border-brand peer-checked:bg-brand-soft peer-checked:font-semibold peer-checked:text-brand">
                {AD_OBJECTIVES[o]}
              </span>
            </label>
          ))}
        </div>
        <p className="mt-2 text-xs text-ink-soft">Seuls les objectifs réellement proposés par {cfg.name} sont affichés.</p>
      </Step>

      <Step n={3} title="Ce que vous voulez promouvoir">
        <div className="space-y-3">
          <textarea name="offer" required minLength={10} maxLength={800} rows={3} className="input resize-y" placeholder="Ex. : notre nouveau menu du midi, cuisiné maison avec des produits locaux." />
          <div>
            <label className="label" htmlFor="ad-facts">Informations à mentionner (facultatif)</label>
            <textarea id="ad-facts" name="facts" maxLength={800} rows={2} className="input resize-y" placeholder="Prix, dates, offre… L'IA n'utilisera rien d'autre." />
          </div>
          <div>
            <label className="label" htmlFor="ad-url">Page de destination</label>
            <input id="ad-url" name="landingUrl" className="input" inputMode="url" defaultValue={defaultUrl} placeholder="www.votre-site.fr" />
          </div>
        </div>
      </Step>

      <Step n={4} title="Visuel">
        <input type="hidden" name="creationId" value={creationId} />
        {creations.length ? (
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
            {creations.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setCreationId(creationId === c.id ? "" : c.id)}
                className={`aspect-square overflow-hidden rounded-lg bg-canvas ring-2 ${creationId === c.id ? "ring-brand" : "ring-transparent"}`}
                title={c.title ?? ""}
              >
                {c.url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={c.url} alt="" className="size-full object-cover" />
                )}
              </button>
            ))}
          </div>
        ) : (
          <p className="text-sm text-ink-soft">
            Aucun visuel pour l&apos;instant. Créez-en un dans le <Link href="/studio" className="font-semibold text-brand">Studio créatif</Link> : il apparaîtra ici.
          </p>
        )}
      </Step>

      <Step n={5} title="Zone et public">
        <div>
          <label className="label" htmlFor="ad-city">Ville du commerce</label>
          <input id="ad-city" name="city" className="input" defaultValue={defaultCity} maxLength={100} />
        </div>
        <p className="mt-2 text-sm text-ink-soft">
          Publia proposera un rayon autour du commerce, une tranche d&apos;âge et des centres d&apos;intérêt généraux. Aucun
          ciblage sur des données sensibles (santé, religion, opinions, origine, orientation, situation financière).
        </p>
      </Step>

      <Step n={6} title="Budget et durée">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="ad-daily">Budget quotidien (€)</label>
            <input id="ad-daily" name="daily" inputMode="decimal" className="input" value={daily} onChange={(e) => setDaily(e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="ad-cap">Plafond de dépense total (€)</label>
            <input id="ad-cap" inputMode="decimal" className="input" value={cap} placeholder={budget.planned > 0 ? (budget.planned / 100).toString() : ""} onChange={(e) => setCap(e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="ad-start">Début</label>
            <input id="ad-start" name="start" type="date" min={today} className="input" value={start} onChange={(e) => setStart(e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="ad-end">Fin</label>
            <input id="ad-end" name="end" type="date" min={start} className="input" value={end} onChange={(e) => setEnd(e.target.value)} />
          </div>
        </div>
        <div className="mt-4 rounded-xl bg-canvas p-4 text-sm">
          {budget.check.ok ? (
            <p>
              <span className="font-semibold">Budget prévu : {euros(budget.planned)}</span> sur {budget.check.days} jour{budget.check.days > 1 ? "s" : ""} · plafond {euros(budget.capCents)}
            </p>
          ) : (
            <p className="text-danger">{budget.check.error}</p>
          )}
          <p className="mt-1 text-ink-soft">
            Les dépenses publicitaires sont facturées directement par {cfg.name}, séparément de l&apos;abonnement Publia. Rien ne sera engagé sans votre validation.
          </p>
        </div>
      </Step>

      <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
        <Submit disabled={disabled || !budget.check.ok} />
        <p className="text-sm text-ink-soft">Utilise 1 génération · {remaining} restante{remaining > 1 ? "s" : ""} ce mois-ci</p>
      </div>
      {state?.error && <p role="alert" className="rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">{state.error}</p>}
    </form>
  );
}
