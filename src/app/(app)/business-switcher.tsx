"use client";

import { useTransition } from "react";
import { Loader2, Store } from "lucide-react";
import { switchBusiness } from "./organisation/actions";

type Props = { currentId: string | null; businesses: { id: string; name: string; organization: string }[]; compact?: boolean };

/** Sélecteur du commerce actif (affiché seulement si l'utilisateur en a plusieurs). */
export function BusinessSwitcher({ currentId, businesses, compact }: Props) {
  const [pending, start] = useTransition();
  const current = businesses.find((b) => b.id === currentId);
  if (!current) return null;
  if (businesses.length < 2)
    return <p className={`truncate text-sm text-ink-soft ${compact ? "max-w-[10rem]" : "mt-3"}`}>{current.name}</p>;

  const orgs = Array.from(new Set(businesses.map((b) => b.organization)));
  return (
    <label className={`flex items-center gap-2 ${compact ? "max-w-[11rem]" : "mt-3"}`}>
      {pending ? <Loader2 className="size-4 shrink-0 animate-spin text-ink-soft" /> : <Store className="size-4 shrink-0 text-ink-soft" />}
      <span className="sr-only">Commerce actif</span>
      <select
        className="min-w-0 flex-1 truncate rounded-lg border border-line bg-white px-2 py-1.5 text-sm text-ink focus:border-brand focus:outline-none"
        value={current.id}
        disabled={pending}
        onChange={(e) => {
          const id = e.target.value;
          start(async () => {
            await switchBusiness(id);
          });
        }}
      >
        {orgs.length > 1
          ? orgs.map((o) => (
              <optgroup key={o} label={o}>
                {businesses.filter((b) => b.organization === o).map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </optgroup>
            ))
          : businesses.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
      </select>
    </label>
  );
}
