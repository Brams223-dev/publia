"use client";

import { useState, useTransition } from "react";
import { Check, Pencil } from "lucide-react";
import { toggleVariant, updateVariant } from "../actions";
import { AdPreview } from "../ad-preview";

export type Variant = {
  id: string;
  angle: string | null;
  headline: string;
  primary_text: string;
  description: string | null;
  cta: string;
  selected: boolean;
};

export function VariantCard({
  v,
  index,
  preview,
  ctas,
  limits,
  locked,
}: {
  v: Variant;
  index: number;
  preview: { platform: string; businessName: string; logoUrl: string | null; imageUrl: string | null; url: string | null };
  ctas: string[];
  limits: { headline: number; primary: number; description: number };
  locked: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [d, setD] = useState({ headline: v.headline, primary_text: v.primary_text, description: v.description ?? "", cta: v.cta });
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const letter = String.fromCharCode(65 + index);

  const counter = (val: string, max: number) => (
    <span className={`text-xs ${val.length > max ? "text-danger" : "text-ink-soft"}`}>{val.length}/{max}</span>
  );

  return (
    <article className={`card flex flex-col p-4 ${v.selected ? "ring-2 ring-brand" : ""}`}>
      <header className="mb-3 flex items-center gap-2">
        <span className="grid size-7 place-items-center rounded-full bg-brand text-sm font-bold text-white">{letter}</span>
        <p className="min-w-0 flex-1 truncate text-sm text-ink-soft">{v.angle}</p>
        <label className={`flex items-center gap-1.5 text-sm ${locked ? "opacity-50" : "cursor-pointer"}`}>
          <input
            type="checkbox"
            className="size-4 accent-brand"
            checked={v.selected}
            disabled={locked || pending}
            onChange={(e) => start(() => toggleVariant(v.id, e.target.checked).then(() => {}))}
          />
          Retenue
        </label>
      </header>

      <AdPreview {...preview} headline={d.headline} primaryText={d.primary_text} description={d.description} cta={d.cta} />

      {editing ? (
        <div className="mt-3 space-y-2">
          <label className="block text-sm">
            <span className="flex justify-between"><span className="font-medium">Titre</span>{counter(d.headline, limits.headline)}</span>
            <input className="input mt-1" value={d.headline} onChange={(e) => setD({ ...d, headline: e.target.value })} />
          </label>
          <label className="block text-sm">
            <span className="flex justify-between"><span className="font-medium">Texte</span>{counter(d.primary_text, limits.primary)}</span>
            <textarea rows={3} className="input mt-1 resize-y" value={d.primary_text} onChange={(e) => setD({ ...d, primary_text: e.target.value })} />
          </label>
          {limits.description > 0 && (
            <label className="block text-sm">
              <span className="flex justify-between"><span className="font-medium">Description</span>{counter(d.description, limits.description)}</span>
              <input className="input mt-1" value={d.description} onChange={(e) => setD({ ...d, description: e.target.value })} />
            </label>
          )}
          <label className="block text-sm">
            <span className="font-medium">Bouton</span>
            <select className="input mt-1" value={d.cta} onChange={(e) => setD({ ...d, cta: e.target.value })}>
              {ctas.map((c) => <option key={c}>{c}</option>)}
            </select>
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              className="btn-primary px-4 py-2"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  setError(null);
                  if (d.headline.length > limits.headline || d.primary_text.length > limits.primary || d.description.length > limits.description)
                    return setError("Un champ dépasse la longueur recommandée par la régie.");
                  const r = await updateVariant({ id: v.id, ...d });
                  if (r.error) setError(r.error);
                  else setEditing(false);
                })
              }
            >
              <Check className="size-4" /> Enregistrer
            </button>
            <button type="button" className="btn-ghost px-4 py-2" onClick={() => setEditing(false)}>Annuler</button>
          </div>
        </div>
      ) : (
        !locked && (
          <button type="button" className="btn-ghost mt-3 self-start px-4 py-2" onClick={() => setEditing(true)}>
            <Pencil className="size-4" /> Modifier
          </button>
        )
      )}
      {error && <p role="alert" className="mt-2 text-sm text-danger">{error}</p>}
    </article>
  );
}
