"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ImagePlus, Trash2, Upload } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { addPhoto, deletePhoto, removeLogo, setLogo } from "./actions";
import { LOGO_MAX_BYTES, LOGO_TYPES, MAX_PHOTOS, PHOTO_MAX_BYTES, PHOTO_TYPES } from "@/lib/config/business";

type Photo = { id: string; url: string | null };

const EXT: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };
const mb = (b: number) => `${Math.round(b / 1024 / 1024)} Mo`;

function checkFile(file: File, types: string[], max: number) {
  if (!types.includes(file.type)) return "Format non pris en charge : utilisez PNG, JPG ou WebP.";
  if (file.size > max) return `Fichier trop lourd (${mb(max)} maximum).`;
  return null;
}

export function BrandMedia({
  businessId,
  logoUrl,
  photos,
}: {
  businessId: string;
  logoUrl: string | null;
  photos: Photo[];
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const logoInput = useRef<HTMLInputElement>(null);
  const photoInput = useRef<HTMLInputElement>(null);

  async function upload(bucket: "brand-assets" | "uploads", folder: string, file: File) {
    const supabase = createClient();
    const path = `${businessId}/${folder}/${crypto.randomUUID()}.${EXT[file.type]}`;
    const { error } = await supabase.storage.from(bucket).upload(path, file, { contentType: file.type, upsert: false });
    if (error) throw new Error(error.message);
    return path;
  }

  async function onLogo(file: File | undefined) {
    if (!file) return;
    setError(null);
    const problem = checkFile(file, LOGO_TYPES, LOGO_MAX_BYTES);
    if (problem) return setError(problem);
    setBusy("logo");
    try {
      const path = await upload("brand-assets", "logo", file);
      const res = await setLogo(path);
      if (res.error) setError(res.error);
      startTransition(() => router.refresh());
    } catch {
      setError("L'envoi du logo a échoué. Vérifiez votre connexion et réessayez.");
    } finally {
      setBusy(null);
      if (logoInput.current) logoInput.current.value = "";
    }
  }

  async function onPhotos(files: FileList | null) {
    if (!files?.length) return;
    setError(null);
    const list = Array.from(files).slice(0, Math.max(0, MAX_PHOTOS - photos.length));
    if (list.length < files.length) setError(`Maximum ${MAX_PHOTOS} photos : certaines n'ont pas été ajoutées.`);
    setBusy("photos");
    let failed = 0;
    for (const file of list) {
      const problem = checkFile(file, PHOTO_TYPES, PHOTO_MAX_BYTES);
      if (problem) {
        failed++;
        continue;
      }
      try {
        const path = await upload("uploads", "photos", file);
        const res = await addPhoto(path);
        if (res.error) {
          setError(res.error);
          break;
        }
      } catch {
        failed++;
      }
    }
    if (failed) setError(`${failed} photo(s) non ajoutée(s) : format PNG, JPG ou WebP, ${mb(PHOTO_MAX_BYTES)} maximum.`);
    setBusy(null);
    if (photoInput.current) photoInput.current.value = "";
    startTransition(() => router.refresh());
  }

  async function run(key: string, fn: () => Promise<{ error?: string }>) {
    setError(null);
    setBusy(key);
    const res = await fn();
    if (res.error) setError(res.error);
    setBusy(null);
    startTransition(() => router.refresh());
  }

  return (
    <div className="space-y-6">
      <section className="card p-5 sm:p-6">
        <h2 className="font-semibold">Logo</h2>
        <p className="mt-1 text-sm text-ink-soft">PNG avec fond transparent conseillé. {mb(LOGO_MAX_BYTES)} maximum.</p>
        <div className="mt-4 flex flex-wrap items-center gap-4">
          <div className="grid size-24 place-items-center overflow-hidden rounded-2xl border border-dashed border-line bg-canvas">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt="Logo du commerce" className="size-full object-contain p-2" />
            ) : (
              <ImagePlus className="size-6 text-ink-soft" />
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <input
              ref={logoInput}
              type="file"
              accept={LOGO_TYPES.join(",")}
              className="sr-only"
              id="logo-input"
              onChange={(e) => onLogo(e.target.files?.[0])}
            />
            <label htmlFor="logo-input" className={`btn-ghost cursor-pointer ${busy ? "pointer-events-none opacity-50" : ""}`}>
              <Upload className="size-4" /> {busy === "logo" ? "Envoi…" : logoUrl ? "Remplacer" : "Importer le logo"}
            </label>
            {logoUrl && (
              <button type="button" className="btn-ghost" disabled={!!busy} onClick={() => run("logo-rm", removeLogo)}>
                <Trash2 className="size-4" /> Retirer
              </button>
            )}
          </div>
        </div>
      </section>

      <section className="card p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold">Photos du commerce</h2>
            <p className="mt-1 text-sm text-ink-soft">
              Produits, vitrine, réalisations. {photos.length}/{MAX_PHOTOS} · {mb(PHOTO_MAX_BYTES)} max par photo.
            </p>
          </div>
          <input
            ref={photoInput}
            type="file"
            multiple
            accept={PHOTO_TYPES.join(",")}
            className="sr-only"
            id="photos-input"
            onChange={(e) => onPhotos(e.target.files)}
          />
          <label
            htmlFor="photos-input"
            className={`btn-primary cursor-pointer ${busy || photos.length >= MAX_PHOTOS ? "pointer-events-none opacity-50" : ""}`}
          >
            <ImagePlus className="size-4" /> {busy === "photos" ? "Envoi…" : "Ajouter des photos"}
          </label>
        </div>

        {photos.length === 0 ? (
          <p className="mt-4 rounded-xl bg-canvas px-4 py-6 text-center text-sm text-ink-soft">
            Aucune photo pour l&apos;instant. Elles serviront de base à vos publications et vidéos.
          </p>
        ) : (
          <ul className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-4">
            {photos.map((p) => (
              <li key={p.id} className="group relative aspect-square overflow-hidden rounded-xl bg-canvas">
                {p.url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.url} alt="" className="size-full object-cover" loading="lazy" />
                )}
                <button
                  type="button"
                  aria-label="Supprimer la photo"
                  disabled={!!busy}
                  onClick={() => run(`del-${p.id}`, () => deletePhoto(p.id))}
                  className="absolute top-1.5 right-1.5 grid size-8 place-items-center rounded-full bg-white/90 text-danger shadow transition hover:bg-white sm:opacity-0 sm:group-hover:opacity-100"
                >
                  <Trash2 className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {error && (
        <p role="alert" className="rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
