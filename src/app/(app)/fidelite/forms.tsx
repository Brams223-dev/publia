"use client";

import { useActionState, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { Loader2, Plus } from "lucide-react";
import { createCard, enrollCustomer, saveProgram, type FormState } from "./actions";

function Submit({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <button className="btn-primary" disabled={pending}>
      {pending ? <Loader2 className="size-4 animate-spin" /> : null} {children}
    </button>
  );
}

type Program = { kind: string; stamps_required: number; points_per_euro: number | string; reward_threshold: number; reward_label: string; terms: string | null; active: boolean } | null;

export function ProgramForm({ program }: { program: Program }) {
  const [state, action] = useActionState<FormState, FormData>(saveProgram, undefined);
  const [kind, setKind] = useState(program?.kind ?? "stamps");
  return (
    <form action={action} className="space-y-4">
      <fieldset className="grid gap-2 sm:grid-cols-2">
        <legend className="label">Type de programme</legend>
        {[
          ["stamps", "Tampons", "1 tampon par passage ou achat"],
          ["points", "Points", "Des points selon le montant dépensé"],
        ].map(([v, l, h]) => (
          <label key={v} className={`cursor-pointer rounded-xl border p-3 text-sm ${kind === v ? "border-brand bg-brand-soft" : "border-line"}`}>
            <input type="radio" name="kind" value={v} checked={kind === v} onChange={() => setKind(v)} className="sr-only" />
            <span className="font-medium">{l}</span>
            <span className="block text-xs text-ink-soft">{h}</span>
          </label>
        ))}
      </fieldset>
      {kind === "stamps" ? (
        <div>
          <label className="label" htmlFor="stamps_required">Nombre de tampons pour la récompense</label>
          <input id="stamps_required" name="stamps_required" type="number" min={2} max={50} defaultValue={program?.stamps_required ?? 10} className="input" />
          <input type="hidden" name="points_per_euro" value={program?.points_per_euro ?? 1} />
          <input type="hidden" name="reward_threshold" value={program?.reward_threshold ?? 100} />
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="points_per_euro">Points par euro dépensé</label>
            <input id="points_per_euro" name="points_per_euro" type="number" step="0.1" min={0.1} max={100} defaultValue={program?.points_per_euro ?? 1} className="input" />
          </div>
          <div>
            <label className="label" htmlFor="reward_threshold">Points pour la récompense</label>
            <input id="reward_threshold" name="reward_threshold" type="number" min={1} max={100000} defaultValue={program?.reward_threshold ?? 100} className="input" />
          </div>
          <input type="hidden" name="stamps_required" value={program?.stamps_required ?? 10} />
        </div>
      )}
      <div>
        <label className="label" htmlFor="reward_label">Récompense</label>
        <input id="reward_label" name="reward_label" required maxLength={120} defaultValue={program?.reward_label ?? ""} className="input" placeholder="Ex. : un café offert, 10 € de réduction" />
      </div>
      <div>
        <label className="label" htmlFor="terms">Conditions (affichées au client)</label>
        <textarea id="terms" name="terms" rows={2} maxLength={1000} defaultValue={program?.terms ?? ""} className="input" placeholder="Ex. : non cumulable, valable en boutique uniquement" />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="active" defaultChecked={program?.active ?? true} className="size-4 accent-brand" /> Programme actif
      </label>
      <Submit>Enregistrer le programme</Submit>
      {state?.error ? <p className="text-sm text-danger">{state.error}</p> : null}
      {state?.success ? <p className="text-sm text-success">{state.success}</p> : null}
    </form>
  );
}

export function EnrollForm() {
  const [state, action] = useActionState<FormState, FormData>(enrollCustomer, undefined);
  return (
    <form action={action} className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
        <input name="first_name" required maxLength={80} placeholder="Prénom" aria-label="Prénom" className="input" />
        <input name="last_name" maxLength={80} placeholder="Nom (facultatif)" aria-label="Nom" className="input" />
        <input name="phone" maxLength={40} placeholder="Téléphone" aria-label="Téléphone" className="input" />
        <input name="email" type="email" maxLength={254} placeholder="E-mail" aria-label="E-mail" className="input" />
      </div>
      <label className="flex items-start gap-2 text-xs">
        <input type="checkbox" name="consent" className="mt-0.5 size-4 accent-brand" />
        <span>Le client accepte de recevoir les offres du commerce (à cocher seulement s&apos;il l&apos;a dit).</span>
      </label>
      <Submit><Plus className="size-4" /> Créer la carte</Submit>
      {state?.error ? <p className="text-sm text-danger">{state.error}</p> : null}
    </form>
  );
}

export function CreateCardButton({ contactId }: { contactId: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <button type="button" className="btn-primary" disabled={pending} onClick={() => start(async () => { const r = await createCard(contactId); if (r?.error) setError(r.error); })}>
        {pending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />} Créer la carte
      </button>
      {error ? <p className="w-full text-sm text-danger">{error}</p> : null}
    </>
  );
}
