"use client";

import { useState, useTransition } from "react";
import { Check, Copy, Pause, Play, X, CalendarClock, ExternalLink } from "lucide-react";
import Link from "next/link";
import { cancelPost, markPublished, pausePost, resumePost, schedulePost } from "../autopilot/actions";
import { FORMAT_LABELS } from "@/lib/campaigns/config";
import { PLATFORM_LABELS, type Platform } from "@/lib/config/platforms";

export type ScheduledPost = {
  id: string;
  campaign_id: string | null;
  platform: Platform;
  format: string | null;
  title: string | null;
  caption: string | null;
  call_to_action: string | null;
  hashtags: string[];
  publish_status: string;
  scheduled_at: string | null;
  published_at: string | null;
  localDay: string;
  localTime: string;
};

const DOT: Record<Platform, string> = {
  instagram: "bg-pink-500",
  facebook: "bg-blue-600",
  tiktok: "bg-neutral-900",
  youtube: "bg-red-600",
};

export function statusOf(p: Pick<ScheduledPost, "publish_status" | "scheduled_at">) {
  if (p.publish_status === "published") return { label: "Publié", cls: "bg-success/10 text-success" };
  if (p.publish_status === "paused") return { label: "En pause", cls: "bg-neutral-100 text-neutral-700" };
  if (p.publish_status === "failed") return { label: "Échec", cls: "bg-danger/10 text-danger" };
  if (p.publish_status === "scheduled" && p.scheduled_at && new Date(p.scheduled_at) <= new Date())
    return { label: "À publier maintenant", cls: "bg-amber-100 text-amber-900" };
  return { label: "Programmé", cls: "bg-brand-soft text-brand" };
}

function textOf(p: ScheduledPost) {
  const parts = p.platform === "youtube" ? [p.caption, p.call_to_action] : [p.title, p.caption, p.call_to_action];
  return [...parts.filter(Boolean), p.hashtags.join(" ")].filter(Boolean).join("\n\n");
}

export function PlatformDot({ platform }: { platform: Platform }) {
  return <span className={`inline-block size-2 shrink-0 rounded-full ${DOT[platform]}`} />;
}

export function ScheduledItem({ post, compact = false }: { post: ScheduledPost; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const [moving, setMoving] = useState(false);
  const [day, setDay] = useState(post.localDay);
  const [time, setTime] = useState(post.localTime);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const status = statusOf(post);
  const done = post.publish_status === "published";

  const run = (fn: () => Promise<{ error?: string }>) =>
    start(async () => {
      setError(null);
      const r = await fn();
      if (r.error) setError(r.error);
      else setMoving(false);
    });

  async function copy() {
    try {
      await navigator.clipboard.writeText(textOf(post));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setError("Copie impossible sur ce navigateur.");
    }
  }

  return (
    <div className={`rounded-xl border border-line bg-white ${compact ? "p-2.5" : "p-3.5"}`}>
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full items-start gap-2 text-left">
        <PlatformDot platform={post.platform} />
        <span className="min-w-0 flex-1">
          <span className="block text-xs text-ink-soft">
            {post.localTime} · {PLATFORM_LABELS[post.platform]}
            {post.format ? ` · ${FORMAT_LABELS[post.format]}` : ""}
          </span>
          <span className={`block truncate font-medium ${compact ? "text-xs" : "text-sm"}`}>{post.title}</span>
        </span>
        {!compact && <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${status.cls}`}>{status.label}</span>}
      </button>

      {open && (
        <div className="mt-3 space-y-3 border-t border-line pt-3">
          {compact && <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ${status.cls}`}>{status.label}</span>}
          <p className="line-clamp-4 whitespace-pre-line text-sm text-ink-soft">{post.caption}</p>

          {moving && (
            <div className="flex flex-wrap items-end gap-2">
              <input type="date" className="input w-auto py-2" value={day} onChange={(e) => setDay(e.target.value)} aria-label="Date" />
              <input type="time" className="input w-auto py-2" value={time} onChange={(e) => setTime(e.target.value)} aria-label="Heure" />
              <button type="button" className="btn-primary px-4 py-2" disabled={pending} onClick={() => run(() => schedulePost(post.id, day, time))}>
                Enregistrer
              </button>
            </div>
          )}

          <div className="flex flex-wrap gap-1.5">
            <button type="button" className="btn-ghost px-3 py-1.5 text-xs" onClick={copy}>
              {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />} {copied ? "Copié" : "Copier"}
            </button>
            {!done && (
              <>
                <button type="button" className="btn-primary px-3 py-1.5 text-xs" disabled={pending} onClick={() => run(() => markPublished(post.id))}>
                  <Check className="size-3.5" /> Marquer publié
                </button>
                <button type="button" className="btn-ghost px-3 py-1.5 text-xs" onClick={() => setMoving((m) => !m)}>
                  <CalendarClock className="size-3.5" /> Déplacer
                </button>
                {post.publish_status === "scheduled" && (
                  <button type="button" className="btn-ghost px-3 py-1.5 text-xs" disabled={pending} onClick={() => run(() => pausePost(post.id))}>
                    <Pause className="size-3.5" /> Pause
                  </button>
                )}
                {post.publish_status === "paused" && (
                  <button type="button" className="btn-ghost px-3 py-1.5 text-xs" disabled={pending} onClick={() => run(() => resumePost(post.id))}>
                    <Play className="size-3.5" /> Reprendre
                  </button>
                )}
                <button type="button" className="btn-ghost px-3 py-1.5 text-xs text-danger" disabled={pending} onClick={() => run(() => cancelPost(post.id))}>
                  <X className="size-3.5" /> Déprogrammer
                </button>
              </>
            )}
            {post.campaign_id && (
              <Link href={`/campagnes/${post.campaign_id}`} className="btn-ghost px-3 py-1.5 text-xs">
                <ExternalLink className="size-3.5" /> Campagne
              </Link>
            )}
          </div>
          {error && <p role="alert" className="text-xs text-danger">{error}</p>}
        </div>
      )}
    </div>
  );
}
