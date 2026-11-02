"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import { submitReview, type PublicFormState } from "../actions";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button className="btn-primary" style={{ background: "var(--site-primary)" }} disabled={pending}>
      {pending ? <Loader2 className="size-4 animate-spin" /> : null} Publier mon avis
    </button>
  );
}

export function ReviewForm({ slug, googleUrl }: { slug: string; googleUrl: string | null }) {
  const [state, action] = useActionState<PublicFormState, FormData>(submitReview, undefined);
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);

  if (state?.success)
    return (
      <div className="space-y-3">
        <p className="rounded-xl bg-success/10 p-4 text-sm text-success">{state.success}</p>
        {googleUrl ? (
          <p className="text-sm text-ink-soft">
            Vous pouvez aussi, si vous le souhaitez, publier votre avis sur{" "}
            <a href={googleUrl} target="_blank" rel="noopener noreferrer" className="underline">Google</a>.
          </p>
        ) : null}
      </div>
    );

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="rating" value={rating || ""} />
      <div className="hidden" aria-hidden>
        <label htmlFor="website">Ne pas remplir</label>
        <input id="website" name="website" tabIndex={-1} autoComplete="off" />
      </div>
      <fieldset>
        <legend className="label">Votre note</legend>
        <div className="flex gap-1" onMouseLeave={() => setHover(0)}>
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              aria-label={`${n} sur 5`}
              aria-pressed={rating === n}
              onMouseEnter={() => setHover(n)}
              onClick={() => setRating(n)}
              className={`text-3xl leading-none transition ${(hover || rating) >= n ? "text-amber-500" : "text-neutral-300"}`}
            >
              ★
            </button>
          ))}
        </div>
      </fieldset>
      <div>
        <label className="label" htmlFor="author_name">Prénom ou pseudonyme (publié)</label>
        <input id="author_name" name="author_name" required minLength={2} maxLength={80} className="input" />
      </div>
      <div>
        <label className="label" htmlFor="comment">Votre avis (facultatif)</label>
        <textarea id="comment" name="comment" rows={4} maxLength={2000} className="input" />
      </div>
      <div>
        <label className="label" htmlFor="email">E-mail (facultatif, non publié)</label>
        <input id="email" name="email" type="email" maxLength={254} className="input" />
      </div>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" name="agree" required className="mt-0.5 size-4" />
        <span>J&apos;atteste que cet avis reflète mon expérience réelle et j&apos;accepte sa publication.</span>
      </label>
      <Submit />
      {state?.error ? <p className="text-sm text-danger">{state.error}</p> : null}
    </form>
  );
}
