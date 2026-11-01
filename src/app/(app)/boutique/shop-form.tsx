"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Check, Loader2 } from "lucide-react";
import type { ShopTemplate } from "@/lib/commerce/config";
import { saveShop } from "../catalogue/actions";

type T = ShopTemplate & { categoryNames: string[]; filterNames: string[] };

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button className="btn-primary" disabled={pending}>
      {pending ? <Loader2 className="size-4 animate-spin" /> : null} Enregistrer
    </button>
  );
}

export function ShopForm({ current, name, templates }: { current: string; name: string; templates: T[] }) {
  const [selected, setSelected] = useState(current);
  const [state, action] = useActionState(saveShop, undefined);

  return (
    <form action={action} className="space-y-6">
      <div className="card max-w-xl p-5">
        <label className="label" htmlFor="name">Nom de la boutique</label>
        <input id="name" name="name" maxLength={80} defaultValue={name} className="input" />
      </div>

      <fieldset>
        <legend className="mb-3 font-semibold">Modèle de boutique</legend>
        <input type="hidden" name="template" value={selected} />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {templates.map((t) => {
            const on = t.id === selected;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setSelected(t.id)}
                aria-pressed={on}
                className={`card relative overflow-hidden p-4 text-left transition ${on ? "border-brand ring-2 ring-brand/20" : "hover:border-brand-light"}`}
              >
                <span className="absolute inset-x-0 top-0 h-1.5" style={{ background: t.accent }} />
                <span className="flex items-start justify-between gap-2">
                  <span className="font-semibold">{t.name}</span>
                  {on ? <span className="grid size-6 place-items-center rounded-full bg-brand text-white"><Check className="size-3.5" /></span> : null}
                </span>
                <span className="mt-1 block text-sm text-ink-soft">{t.description}</span>
                {t.categoryNames.length ? <span className="mt-3 block text-xs"><span className="font-medium">Catégories : </span>{t.categoryNames.join(", ")}</span> : null}
                {t.filterNames.length ? <span className="mt-1 block text-xs"><span className="font-medium">Filtres : </span>{t.filterNames.join(", ")}</span> : null}
                <span className="mt-2 flex flex-wrap gap-1">
                  {t.features.map((f) => <span key={f} className="rounded-full bg-brand-soft px-2 py-0.5 text-[11px] text-brand">{f}</span>)}
                </span>
              </button>
            );
          })}
        </div>
      </fieldset>

      <div className="flex items-center gap-3">
        <Submit />
        {state?.error ? <p className="text-sm text-danger">{state.error}</p> : null}
        {state && "ok" in state && state.ok ? <p className="text-sm text-success">Modèle enregistré.</p> : null}
      </div>
    </form>
  );
}
