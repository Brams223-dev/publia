import { History } from "lucide-react";
import { describe } from "./activity-labels";

export type AuditEntry = { id: number; created_at: string; when: string; actor: string; action: string; details: Record<string, unknown> };

export function ActivityLog({ entries }: { entries: AuditEntry[] }) {
  return (
    <section className="card space-y-4 p-5">
      <h2 className="flex items-center gap-2 font-semibold"><History className="size-4 text-brand" /> Journal d&apos;activité</h2>
      {entries.length ? (
        <ul className="divide-y divide-line text-sm">
          {entries.map((e) => (
            <li key={e.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 py-2.5">
              <span className="min-w-0 flex-1">{describe(e)}</span>
              <span className="text-xs text-ink-soft">{e.actor} · {e.when}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-ink-soft">Aucune activité enregistrée pour le moment.</p>
      )}
      <p className="text-xs text-ink-soft">Visible par le propriétaire et les administrateurs. Les 50 dernières actions sensibles sont affichées.</p>
    </section>
  );
}
