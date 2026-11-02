"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { deleteContact } from "../actions";

export function DeleteContact({ id }: { id: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="card space-y-2 p-4">
      <button
        type="button"
        disabled={pending}
        className="btn-ghost w-full text-danger hover:border-danger hover:text-danger"
        onClick={() => {
          if (!window.confirm("Supprimer définitivement ce contact, sa carte de fidélité et son historique ? (droit à l'effacement)")) return;
          start(async () => {
            const r = await deleteContact(id);
            if (r?.error) setError(r.error);
          });
        }}
      >
        <Trash2 className="size-4" /> Supprimer le contact
      </button>
      <p className="text-xs text-ink-soft">À utiliser notamment si le client demande l&apos;effacement de ses données.</p>
      {error ? <p className="text-sm text-danger">{error}</p> : null}
    </div>
  );
}
