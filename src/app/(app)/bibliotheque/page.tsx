import type { Metadata } from "next";
import Link from "next/link";
import { FolderOpen, Palette } from "lucide-react";
import { getCurrentBusiness } from "@/lib/business";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { STUDIO_FORMATS, formatById } from "@/lib/studio/formats";
import { CreationCard, type CreationItem } from "./creation-card";

export const metadata: Metadata = { title: "Bibliothèque" };

const TTL = 60 * 60;
const dateFr = (iso: string) => new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", year: "numeric" }).format(new Date(iso));

export default async function LibraryPage({ searchParams }: { searchParams: Promise<{ format?: string }> }) {
  if (!isSupabaseConfigured()) return null;
  const { format } = await searchParams;
  const { supabase, business } = await getCurrentBusiness();
  if (!business) return null;

  let query = supabase
    .from("creations")
    .select("id, title, format, file_path, mime_type, created_at")
    .eq("business_id", business.id)
    .order("created_at", { ascending: false })
    .limit(120);
  if (format && STUDIO_FORMATS.some((f) => f.id === format)) query = query.eq("format", format);
  const { data: rows } = await query;

  let items: CreationItem[] = [];
  if (rows?.length) {
    const paths = rows.map((r) => r.file_path);
    const [{ data: views }, downloads] = await Promise.all([
      supabase.storage.from("uploads").createSignedUrls(paths, TTL),
      Promise.all(
        rows.map((r) =>
          supabase.storage.from("uploads").createSignedUrl(r.file_path, TTL, {
            download: `publia-${(r.title ?? "visuel").toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40)}-${r.id.slice(0, 6)}.${r.mime_type === "image/jpeg" ? "jpg" : "png"}`,
          }),
        ),
      ),
    ]);
    items = rows.map((r, i) => {
      const f = formatById(r.format);
      return {
        id: r.id,
        title: r.title,
        formatLabel: f.label,
        ratio: `${f.width} / ${f.height}`,
        url: views?.[i]?.signedUrl ?? null,
        downloadUrl: downloads[i]?.data?.signedUrl ?? null,
        date: dateFr(r.created_at),
      };
    });
  }

  return (
    <div className="mt-4 space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex items-start gap-4">
          <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-brand-soft text-brand">
            <FolderOpen className="size-6" />
          </span>
          <div>
            <h1 className="text-2xl font-semibold sm:text-3xl">Bibliothèque</h1>
            <p className="mt-1 text-ink-soft">Tous vos visuels, prêts à télécharger ou à réutiliser.</p>
          </div>
        </div>
        <Link href="/studio" className="btn-primary"><Palette className="size-4" /> Nouveau visuel</Link>
      </header>

      <nav className="flex gap-1.5 overflow-x-auto pb-1">
        <Link href="/bibliotheque" className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm ${!format ? "bg-brand text-white" : "bg-white text-ink-soft"}`}>Tous</Link>
        {STUDIO_FORMATS.map((f) => (
          <Link key={f.id} href={`/bibliotheque?format=${f.id}`} className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm ${format === f.id ? "bg-brand text-white" : "bg-white text-ink-soft"}`}>
            {f.label}
          </Link>
        ))}
      </nav>

      {items.length === 0 ? (
        <div className="card p-10 text-center">
          <p className="font-semibold">Aucun visuel {format ? "dans ce format" : "pour l'instant"}</p>
          <p className="mt-1 text-sm text-ink-soft">Créez votre premier visuel dans le Studio, ou depuis un contenu de campagne.</p>
          <Link href="/studio" className="btn-primary mt-5">Ouvrir le Studio</Link>
        </div>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {items.map((c) => <CreationCard key={c.id} c={c} />)}
        </ul>
      )}
    </div>
  );
}
