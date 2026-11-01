"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FolderTree, Plus, X } from "lucide-react";
import { createCollection, deleteCollection } from "./actions";

export function CollectionsPanel({ collections }: { collections: { id: string; name: string }[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function add() {
    setError(null);
    start(async () => {
      const r = await createCollection(name);
      if (r.error) setError(r.error);
      else {
        setName("");
        router.refresh();
      }
    });
  }

  return (
    <div className="card space-y-3 p-4">
      <p className="flex items-center gap-2 text-sm font-semibold"><FolderTree className="size-4" /> Collections</p>
      {collections.length ? (
        <ul className="space-y-1 text-sm">
          {collections.map((c) => (
            <li key={c.id} className="flex items-center justify-between gap-2">
              <Link href={`/catalogue?col=${c.id}`} className="min-w-0 truncate hover:text-brand">{c.name}</Link>
              <button
                type="button"
                aria-label={`Supprimer la collection ${c.name}`}
                className="rounded-full p-1 text-ink-soft hover:bg-danger/10 hover:text-danger"
                onClick={() => {
                  if (!window.confirm(`Supprimer la collection « ${c.name} » ? Les produits ne sont pas supprimés.`)) return;
                  start(async () => {
                    await deleteCollection(c.id);
                    router.refresh();
                  });
                }}
              >
                <X className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-ink-soft">Regroupez vos produits : nouveautés, soldes, idées cadeaux…</p>
      )}
      <div className="flex gap-2">
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} placeholder="Nouvelle collection" className="input py-2" />
        <button type="button" onClick={add} disabled={pending || !name.trim()} className="btn-ghost px-3" aria-label="Créer la collection">
          <Plus className="size-4" />
        </button>
      </div>
      {error ? <p className="text-xs text-danger">{error}</p> : null}
    </div>
  );
}
