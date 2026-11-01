"use client";

import { useState, useTransition } from "react";
import { Check, Copy, Lightbulb, Pencil, RotateCcw } from "lucide-react";
import { setPostStatus, updatePost } from "../actions";
import { FORMAT_LABELS } from "@/lib/campaigns/config";
import { PLATFORM_LABELS, type Platform } from "@/lib/config/platforms";

export type Post = {
  id: string;
  platform: Platform;
  format: string | null;
  title: string | null;
  caption: string | null;
  short_caption: string | null;
  call_to_action: string | null;
  hashtags: string[];
  visual_idea: string | null;
  status: string;
};

const PLATFORM_STYLE: Record<Platform, string> = {
  instagram: "bg-pink-50 text-pink-700",
  facebook: "bg-blue-50 text-blue-700",
  tiktok: "bg-neutral-100 text-neutral-800",
  youtube: "bg-red-50 text-red-700",
};

function fullText(p: Pick<Post, "platform" | "title" | "caption" | "call_to_action" | "hashtags">) {
  const parts = p.platform === "youtube" ? [p.caption, p.call_to_action] : [p.title, p.caption, p.call_to_action];
  return [...parts.filter(Boolean), p.hashtags.join(" ")].filter(Boolean).join("\n\n");
}

async function copy(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Repli pour les navigateurs sans API presse-papiers (anciens Safari iOS).
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  }
}

export function PostCard({ post }: { post: Post }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({
    title: post.title ?? "",
    caption: post.caption ?? "",
    call_to_action: post.call_to_action ?? "",
    hashtags: post.hashtags.join(" "),
  });
  const [copied, setCopied] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const ready = post.status === "ready";

  async function doCopy(key: string, text: string) {
    if (await copy(text)) {
      setCopied(key);
      setTimeout(() => setCopied(null), 1800);
    }
  }

  function save() {
    setError(null);
    start(async () => {
      const res = await updatePost({ id: post.id, ...draft });
      if (res.error) setError(res.error);
      else setEditing(false);
    });
  }

  function toggleStatus() {
    setError(null);
    start(async () => {
      const res = await setPostStatus(post.id, ready ? "draft" : "ready");
      if (res.error) setError(res.error);
    });
  }

  return (
    <article className={`card p-5 ${ready ? "ring-1 ring-success/40" : ""}`}>
      <header className="flex flex-wrap items-center gap-2">
        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${PLATFORM_STYLE[post.platform]}`}>
          {PLATFORM_LABELS[post.platform]}
        </span>
        {post.format && <span className="rounded-full bg-canvas px-2.5 py-1 text-xs font-medium text-ink-soft">{FORMAT_LABELS[post.format]}</span>}
        <span className={`ml-auto rounded-full px-2.5 py-1 text-xs font-semibold ${ready ? "bg-success/10 text-success" : "bg-amber-50 text-amber-800"}`}>
          {ready ? "Validé" : "À relire"}
        </span>
      </header>

      {editing ? (
        <div className="mt-4 space-y-3">
          <div>
            <label className="label" htmlFor={`t-${post.id}`}>Titre / accroche</label>
            <input id={`t-${post.id}`} className="input" value={draft.title} maxLength={100} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
          </div>
          <div>
            <label className="label" htmlFor={`c-${post.id}`}>{post.format === "reel" || post.format === "video_courte" || post.format === "short" ? "Script" : "Texte"}</label>
            <textarea id={`c-${post.id}`} rows={7} className="input resize-y" value={draft.caption} onChange={(e) => setDraft({ ...draft, caption: e.target.value })} />
          </div>
          <div>
            <label className="label" htmlFor={`a-${post.id}`}>Appel à l&apos;action</label>
            <input id={`a-${post.id}`} className="input" value={draft.call_to_action} onChange={(e) => setDraft({ ...draft, call_to_action: e.target.value })} />
          </div>
          <div>
            <label className="label" htmlFor={`h-${post.id}`}>Hashtags</label>
            <input id={`h-${post.id}`} className="input" value={draft.hashtags} onChange={(e) => setDraft({ ...draft, hashtags: e.target.value })} />
          </div>
          <div className="flex gap-2">
            <button type="button" className="btn-primary" onClick={save} disabled={pending}>
              {pending ? "Enregistrement…" : "Enregistrer"}
            </button>
            <button type="button" className="btn-ghost" onClick={() => setEditing(false)} disabled={pending}>Annuler</button>
          </div>
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          <h3 className="text-lg font-semibold leading-snug">{post.title}</h3>
          <p className="whitespace-pre-line text-[15px] leading-relaxed">{post.caption}</p>
          {post.call_to_action && <p className="font-medium text-brand">{post.call_to_action}</p>}
          {post.hashtags.length > 0 && <p className="text-sm text-ink-soft">{post.hashtags.join(" ")}</p>}
          {post.visual_idea && (
            <p className="flex gap-2 rounded-xl bg-canvas px-3 py-2.5 text-sm text-ink-soft">
              <Lightbulb className="mt-0.5 size-4 shrink-0 text-brand" />
              <span>
                <span className="font-semibold text-ink">Idée de visuel : </span>
                {post.visual_idea}
              </span>
            </p>
          )}
        </div>
      )}

      {!editing && (
        <footer className="mt-4 flex flex-wrap gap-2 border-t border-line pt-4">
          <button type="button" className="btn-ghost px-4 py-2" onClick={() => doCopy("all", fullText(post))}>
            {copied === "all" ? <Check className="size-4" /> : <Copy className="size-4" />} {copied === "all" ? "Copié" : "Copier le texte"}
          </button>
          {post.platform === "youtube" && post.title && (
            <button type="button" className="btn-ghost px-4 py-2" onClick={() => doCopy("title", post.title!)}>
              {copied === "title" ? <Check className="size-4" /> : <Copy className="size-4" />} {copied === "title" ? "Copié" : "Copier le titre"}
            </button>
          )}
          <button type="button" className="btn-ghost px-4 py-2" onClick={() => setEditing(true)}>
            <Pencil className="size-4" /> Modifier
          </button>
          <button type="button" className={`${ready ? "btn-ghost" : "btn-primary"} ml-auto px-4 py-2`} onClick={toggleStatus} disabled={pending}>
            {ready ? <RotateCcw className="size-4" /> : <Check className="size-4" />} {ready ? "Repasser en relecture" : "Valider"}
          </button>
        </footer>
      )}
      {error && <p role="alert" className="mt-3 text-sm text-danger">{error}</p>}
    </article>
  );
}
