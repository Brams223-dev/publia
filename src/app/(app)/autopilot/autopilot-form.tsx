"use client";

import { useState, useTransition } from "react";
import { CalendarCheck, Info, Wand2 } from "lucide-react";
import { planValidatedPosts, saveAutopilot } from "./actions";
import { WEEKDAYS } from "@/lib/autopilot/time";
import type { Rule, SchedPlatform } from "@/lib/autopilot/scheduler";
import type { Recommendation } from "@/lib/autopilot/recommendations";

const LABELS: Record<SchedPlatform, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  tiktok: "TikTok",
  youtube: "YouTube Shorts",
};

export function AutopilotForm({
  initial,
  recommendations,
  pendingCount,
}: {
  initial: { enabled: boolean; weeksAhead: number; rules: Rule[] };
  recommendations: Recommendation[];
  pendingCount: number;
}) {
  const [enabled, setEnabled] = useState(initial.enabled);
  const [weeksAhead, setWeeksAhead] = useState(initial.weeksAhead);
  const [rules, setRules] = useState<Record<SchedPlatform, Rule>>(() =>
    Object.fromEntries(
      recommendations.map((r) => [
        r.platform,
        initial.rules.find((x) => x.platform === r.platform) ?? { platform: r.platform, days: [], time: r.time },
      ]),
    ) as Record<SchedPlatform, Rule>,
  );
  const [msg, setMsg] = useState<{ error?: string; success?: string } | null>(null);
  const [pending, start] = useTransition();

  const update = (p: SchedPlatform, patch: Partial<Rule>) => setRules((r) => ({ ...r, [p]: { ...r[p], ...patch } }));
  const toggleDay = (p: SchedPlatform, d: number) =>
    update(p, { days: rules[p].days.includes(d) ? rules[p].days.filter((x) => x !== d) : [...rules[p].days, d].sort() });

  const perWeek = Object.values(rules).reduce((n, r) => n + r.days.length, 0);

  function save(then?: () => Promise<{ error?: string; success?: string }>) {
    setMsg(null);
    start(async () => {
      const res = await saveAutopilot({ enabled, weeksAhead, rules: Object.values(rules) });
      if (res.error || !then) return setMsg(res);
      setMsg(await then());
    });
  }

  return (
    <div className="space-y-6">
      <section className="card flex flex-wrap items-center gap-4 p-5 sm:p-6">
        <div className="flex-1">
          <p className="font-semibold">Automatisation hebdomadaire</p>
          <p className="text-sm text-ink-soft">
            {enabled ? `${perWeek} publication${perWeek > 1 ? "s" : ""} par semaine, programmées ${weeksAhead} semaine${weeksAhead > 1 ? "s" : ""} à l'avance.` : "Désactivée. Rien ne sera programmé automatiquement."}
          </p>
        </div>
        <label className="relative inline-flex cursor-pointer items-center">
          <input type="checkbox" className="peer sr-only" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
          <span className="h-7 w-12 rounded-full bg-line transition peer-checked:bg-brand" />
          <span className="absolute left-1 size-5 rounded-full bg-white shadow transition peer-checked:translate-x-5" />
          <span className="sr-only">Activer l&apos;Autopilot</span>
        </label>
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold">Jours, horaires et créneaux recommandés</h2>
        {recommendations.map((rec) => {
          const r = rules[rec.platform];
          return (
            <div key={rec.platform} className="card p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="font-semibold">{LABELS[rec.platform]}</p>
                <div className="flex items-center gap-2">
                  <label htmlFor={`time-${rec.platform}`} className="text-sm text-ink-soft">Heure</label>
                  <input
                    id={`time-${rec.platform}`}
                    type="time"
                    value={r.time}
                    onChange={(e) => update(rec.platform, { time: e.target.value })}
                    className="input w-auto py-2"
                  />
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5" role="group" aria-label={`Jours ${LABELS[rec.platform]}`}>
                {WEEKDAYS.map((d) => {
                  const on = r.days.includes(d.iso);
                  return (
                    <button
                      key={d.iso}
                      type="button"
                      aria-pressed={on}
                      title={d.label}
                      onClick={() => toggleDay(rec.platform, d.iso)}
                      className={`size-10 rounded-full text-sm font-semibold transition ${on ? "bg-brand text-white" : "border border-line bg-white text-ink-soft hover:border-brand-light"}`}
                    >
                      {d.short}
                    </button>
                  );
                })}
              </div>
              <div className="mt-4 rounded-xl bg-canvas p-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">Créneau conseillé : {rec.days.map((d) => WEEKDAYS[d - 1].label.toLowerCase()).join(", ")} à {rec.time.replace(":", " h ")}</span>
                  <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-800">Confiance {rec.confidence}</span>
                  <button type="button" className="ml-auto text-sm font-semibold text-brand hover:underline" onClick={() => update(rec.platform, { time: rec.time, days: rec.days })}>
                    Utiliser
                  </button>
                </div>
                <p className="mt-1.5 text-ink-soft">{rec.justification}</p>
                <p className="mt-1 text-ink-soft">Autres horaires possibles : {rec.alternatives.map((a) => a.replace(":", " h ")).join(" · ")}</p>
              </div>
            </div>
          );
        })}
      </section>

      <section className="card flex flex-wrap items-center gap-4 p-5">
        <label htmlFor="weeks" className="flex-1 text-sm font-medium">Programmer à l&apos;avance sur</label>
        <select id="weeks" className="input w-auto" value={weeksAhead} onChange={(e) => setWeeksAhead(Number(e.target.value))}>
          {[1, 2, 3, 4].map((w) => (
            <option key={w} value={w}>{w} semaine{w > 1 ? "s" : ""}</option>
          ))}
        </select>
      </section>

      <div className="flex flex-wrap gap-3">
        <button type="button" className="btn-ghost px-6 py-3" disabled={pending} onClick={() => save()}>
          <CalendarCheck className="size-4" /> Enregistrer
        </button>
        <button type="button" className="btn-primary px-6 py-3" disabled={pending || !enabled} onClick={() => save(planValidatedPosts)}>
          <Wand2 className="size-4" /> {pending ? "Planification…" : `Planifier mes contenus validés (${pendingCount})`}
        </button>
      </div>
      {msg?.error && <p role="alert" className="rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">{msg.error}</p>}
      {msg?.success && <p role="status" className="rounded-xl bg-success/10 px-4 py-3 text-sm text-success">{msg.success}</p>}

      <p className="flex gap-2 text-sm text-ink-soft">
        <Info className="mt-0.5 size-4 shrink-0" />
        Seuls les contenus que vous avez validés sont programmés. Rien n&apos;est publié sans votre accord.
      </p>
    </div>
  );
}
