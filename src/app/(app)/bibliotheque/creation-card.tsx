"use client";

import { useTransition } from "react";
import Link from "next/link";
import { Download, Pencil, Trash2 } from "lucide-react";
import { deleteCreation } from "../studio/actions";

export type CreationItem = {
  id: string;
  title: string | null;
  formatLabel: string;
  ratio: string;
  url: string | null;
  downloadUrl: string | null;
  date: string;
};

export function CreationCard({ c }: { c: CreationItem }) {
  const [pending, start] = useTransition();
  return (
    <li className={`card overflow-hidden ${pending ? "opacity-50" : ""}`}>
      <div className="flex aspect-square items-center justify-center bg-canvas p-2">
        {c.url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={c.url} alt={c.title ?? "Visuel"} loading="lazy" className="max-h-full max-w-full rounded-md object-contain shadow-sm" style={{ aspectRatio: c.ratio }} />
        )}
      </div>
      <div className="p-3">
        <p className="truncate text-sm font-semibold">{c.title || "Sans titre"}</p>
        <p className="text-xs text-ink-soft">{c.formatLabel} · {c.date}</p>
        <div className="mt-2.5 flex gap-1.5">
          {c.downloadUrl && (
            <a href={c.downloadUrl} className="btn-ghost flex-1 px-2 py-1.5 text-xs" aria-label="Télécharger">
              <Download className="size-3.5" /> Télécharger
            </a>
          )}
          <Link href={`/studio?creation=${c.id}`} className="btn-ghost px-2.5 py-1.5" aria-label="Réutiliser dans le Studio" title="Réutiliser">
            <Pencil className="size-3.5" />
          </Link>
          <button
            type="button"
            aria-label="Supprimer"
            title="Supprimer"
            disabled={pending}
            className="btn-ghost px-2.5 py-1.5 text-danger"
            onClick={() => {
              if (confirm("Supprimer définitivement ce visuel ?")) start(() => deleteCreation(c.id).then(() => {}));
            }}
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>
      </div>
    </li>
  );
}
