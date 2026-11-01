// SocialScheduler : transforme des règles hebdomadaires en créneaux et y place les contenus validés.
// Fonctions pures, testables, sans accès réseau.

import { z } from "zod";
import { addDays, localDay, zonedToUtc, DEFAULT_TZ } from "./time";

export const SCHEDULABLE_PLATFORMS = ["instagram", "facebook", "tiktok", "youtube"] as const;
export type SchedPlatform = (typeof SCHEDULABLE_PLATFORMS)[number];

export const ruleSchema = z.object({
  platform: z.enum(SCHEDULABLE_PLATFORMS),
  days: z.array(z.number().int().min(1).max(7)).max(7),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Heure invalide."),
});
export type Rule = z.infer<typeof ruleSchema>;

export type Slot = { platform: SchedPlatform; at: Date };

/** Créneaux à venir (après `now`) sur `weeks` semaines, triés chronologiquement. */
export function computeSlots(rules: Rule[], now: Date, weeks: number, tz = DEFAULT_TZ): Slot[] {
  const today = localDay(now, tz).iso;
  const slots: Slot[] = [];
  for (let i = 0; i < weeks * 7; i++) {
    const day = addDays(today, i);
    const weekday = ((new Date(`${day}T12:00:00Z`).getUTCDay() + 6) % 7) + 1;
    for (const r of rules) {
      if (!r.days.includes(weekday)) continue;
      const at = zonedToUtc(day, r.time, tz);
      if (at.getTime() > now.getTime() + 5 * 60_000) slots.push({ platform: r.platform, at });
    }
  }
  return slots.sort((a, b) => a.at.getTime() - b.at.getTime());
}

export type Schedulable = { id: string; platform: string; scheduled_for: string | null };

/**
 * Place chaque contenu sur le premier créneau libre de sa plateforme,
 * sans le programmer avant le jour conseillé par la campagne.
 */
export function assignSlots(posts: Schedulable[], slots: Slot[], taken: Date[] = [], tz = DEFAULT_TZ) {
  const used = new Set(taken.map((d) => d.getTime()));
  const free = slots.filter((s) => !used.has(s.at.getTime()));
  const sorted = [...posts].sort((a, b) => (a.scheduled_for ?? "").localeCompare(b.scheduled_for ?? ""));
  const result: { id: string; at: Date }[] = [];
  const unplaced: string[] = [];

  for (const p of sorted) {
    const idx = free.findIndex(
      (s) => s.platform === p.platform && (!p.scheduled_for || localDay(s.at, tz).iso >= p.scheduled_for),
    );
    if (idx === -1) {
      unplaced.push(p.id);
      continue;
    }
    result.push({ id: p.id, at: free[idx].at });
    free.splice(idx, 1);
  }
  return { assigned: result, unplaced };
}
