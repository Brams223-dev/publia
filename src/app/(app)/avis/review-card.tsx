"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Check, EyeOff, MessageSquareReply, RotateCcw, UserRound } from "lucide-react";
import { moderateReview, replyToReview } from "./actions";

type Review = { id: string; author_name: string; rating: number; comment: string | null; status: string; reply: string | null; when: string; contact_id: string | null };

export function ReviewCard({ review }: { review: Review }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [reply, setReply] = useState(review.reply ?? "");
  const run = (fn: () => Promise<{ error?: string }>) =>
    start(async () => {
      setError(null);
      const r = await fn();
      if (r.error) setError(r.error);
      else setEditing(false);
    });

  return (
    <li className="card space-y-3 p-4 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-base text-amber-500">{"★".repeat(review.rating)}<span className="text-neutral-300">{"★".repeat(5 - review.rating)}</span></span>
        <span className="font-medium">{review.author_name}</span>
        <span className="text-ink-soft">· {review.when}</span>
        {review.contact_id ? <Link href={`/contacts/${review.contact_id}`} className="ml-auto inline-flex items-center gap-1 text-xs text-brand hover:underline"><UserRound className="size-3.5" /> Contact</Link> : null}
      </div>
      {review.comment ? <p className="whitespace-pre-line">{review.comment}</p> : <p className="text-ink-soft">(Note sans commentaire)</p>}

      {editing ? (
        <div className="space-y-2">
          <textarea value={reply} onChange={(e) => setReply(e.target.value)} maxLength={1000} rows={3} className="input" placeholder="Votre réponse publique, courtoise et factuelle" aria-label="Réponse" />
          <div className="flex gap-2">
            <button type="button" className="btn-primary" disabled={pending} onClick={() => run(() => replyToReview(review.id, reply))}>Publier la réponse</button>
            <button type="button" className="btn-ghost" onClick={() => setEditing(false)}>Annuler</button>
          </div>
        </div>
      ) : review.reply ? (
        <p className="rounded-xl bg-canvas p-3 text-ink-soft"><span className="font-medium text-ink">Votre réponse : </span>{review.reply}</p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {review.status !== "published" ? (
          <button type="button" className="btn-primary px-3 py-1.5 text-xs" disabled={pending} onClick={() => run(() => moderateReview(review.id, "published"))}><Check className="size-3.5" /> Publier</button>
        ) : null}
        {!editing ? (
          <button type="button" className="btn-ghost px-3 py-1.5 text-xs" onClick={() => setEditing(true)}><MessageSquareReply className="size-3.5" /> {review.reply ? "Modifier la réponse" : "Répondre"}</button>
        ) : null}
        {review.status !== "hidden" ? (
          <button
            type="button"
            className="btn-ghost px-3 py-1.5 text-xs"
            disabled={pending}
            onClick={() => {
              if (window.confirm("Masquer cet avis ? Uniquement s'il est injurieux, illicite, sans rapport ou manifestement faux. La décision est enregistrée.")) run(() => moderateReview(review.id, "hidden"));
            }}
          >
            <EyeOff className="size-3.5" /> Masquer
          </button>
        ) : (
          <button type="button" className="btn-ghost px-3 py-1.5 text-xs" disabled={pending} onClick={() => run(() => moderateReview(review.id, "pending"))}><RotateCcw className="size-3.5" /> Remettre en attente</button>
        )}
      </div>
      {error ? <p className="text-danger">{error}</p> : null}
    </li>
  );
}
