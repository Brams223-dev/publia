"use client";

import { useActionState, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { ImagePlus, Loader2, PenLine, ShieldCheck, Sparkles, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { LIMITS } from "@/lib/commerce/config";
import { createProduct, generateProduct, type FormState } from "../actions";

type Cat = { id: string; name: string; regulated: boolean };
type Photo = { path: string; url: string };

const EXT: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };
const MAX_AI_PHOTOS = 4;

function Submit({ children, disabled }: { children: React.ReactNode; disabled?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button className="btn-primary" disabled={pending || disabled}>
      {pending ? <Loader2 className="size-4 animate-spin" /> : null}
      {pending ? "Préparation en cours…" : children}
    </button>
  );
}

function CategorySelect({ categories, featuredCount, optional }: { categories: Cat[]; featuredCount: number; optional?: boolean }) {
  const featured = categories.slice(0, featuredCount);
  const others = categories.slice(featuredCount);
  const opt = (c: Cat) => (
    <option key={c.id} value={c.id}>
      {c.name}
      {c.regulated ? " (réglementée)" : ""}
    </option>
  );
  return (
    <select id="categoryId" name="categoryId" className="input" defaultValue="" required={!optional}>
      <option value="">{optional ? "Laisser l'assistant proposer" : "Choisir une catégorie"}</option>
      {featured.length ? (
        <>
          <optgroup label="Pour votre boutique">{featured.map(opt)}</optgroup>
          <optgroup label="Autres catégories">{others.map(opt)}</optgroup>
        </>
      ) : (
        categories.map(opt)
      )}
    </select>
  );
}

export function NewProduct({
  businessId,
  categories,
  featuredCount,
  initialMode,
  aiReady,
  remaining,
}: {
  businessId: string;
  categories: Cat[];
  featuredCount: number;
  initialMode: "ai" | "manual";
  aiReady: boolean;
  remaining: number;
}) {
  const [mode, setMode] = useState(initialMode);
  const [requestId] = useState(() => crypto.randomUUID());
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [uploading, setUploading] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const [aiState, aiAction] = useActionState<FormState, FormData>(generateProduct, undefined);
  const [manualState, manualAction] = useActionState<FormState, FormData>(createProduct, undefined);

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    setPhotoError(null);
    const list = Array.from(files).slice(0, MAX_AI_PHOTOS - photos.length);
    setUploading(true);
    const supabase = createClient();
    for (const file of list) {
      if (!(LIMITS.mediaTypes as readonly string[]).includes(file.type)) {
        setPhotoError("Format non pris en charge : PNG, JPG ou WebP.");
        continue;
      }
      if (file.size > LIMITS.mediaMaxBytes) {
        setPhotoError("Photo trop lourde (15 Mo maximum).");
        continue;
      }
      const path = `${businessId}/products/${crypto.randomUUID()}.${EXT[file.type]}`;
      const { error } = await supabase.storage.from("uploads").upload(path, file, { contentType: file.type });
      if (error) {
        setPhotoError("L'envoi d'une photo a échoué. Réessayez.");
        continue;
      }
      setPhotos((p) => [...p, { path, url: URL.createObjectURL(file) }]);
    }
    setUploading(false);
    if (input.current) input.current.value = "";
  }

  async function removePhoto(path: string) {
    setPhotos((p) => p.filter((x) => x.path !== path));
    await createClient().storage.from("uploads").remove([path]);
  }

  const tabs = (
    <div className="inline-flex rounded-full border border-line bg-white p-1 text-sm">
      {[
        { id: "ai" as const, label: "Avec l'assistant IA", icon: Sparkles },
        { id: "manual" as const, label: "Saisie manuelle", icon: PenLine },
      ].map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => setMode(t.id)}
          className={`inline-flex items-center gap-2 rounded-full px-4 py-2 font-medium transition ${mode === t.id ? "bg-brand text-white" : "text-ink-soft hover:text-brand"}`}
        >
          <t.icon className="size-4" /> {t.label}
        </button>
      ))}
    </div>
  );

  if (mode === "manual")
    return (
      <div className="space-y-4">
        {tabs}
        <form action={manualAction} className="card max-w-2xl space-y-4 p-5">
          <div>
            <label className="label" htmlFor="name">Nom du produit ou du service</label>
            <input id="name" name="name" required minLength={2} maxLength={200} className="input" placeholder="Ex. : Table basse en chêne massif" />
          </div>
          <div>
            <label className="label" htmlFor="categoryId">Catégorie</label>
            <CategorySelect categories={categories} featuredCount={featuredCount} />
            <p className="mt-1 text-xs text-ink-soft">La catégorie détermine les caractéristiques proposées dans la fiche.</p>
          </div>
          {manualState?.error ? <p className="text-sm text-danger">{manualState.error}</p> : null}
          <Submit>Créer la fiche</Submit>
        </form>
      </div>
    );

  return (
    <div className="space-y-4">
      {tabs}
      {!aiReady ? (
        <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          L&apos;assistant IA n&apos;est pas encore activé (clé OpenAI à configurer). Vous pouvez utiliser la saisie manuelle.
        </p>
      ) : null}
      <form action={aiAction} className="card max-w-3xl space-y-5 p-5">
        <input type="hidden" name="requestId" value={requestId} />
        <input type="hidden" name="paths" value={photos.map((p) => p.path).join("\n")} />
        <div>
          <label className="label" htmlFor="text">Décrivez le produit avec vos mots</label>
          <textarea
            id="text"
            name="text"
            required
            minLength={15}
            maxLength={3000}
            rows={6}
            className="input"
            placeholder="Ex. : iPhone 13 reconditionné, 128 Go, bleu, batterie 89 %, garantie 12 mois, livré avec câble USB-C."
          />
          <p className="mt-1 text-xs text-ink-soft">
            Indiquez tout ce que vous savez : marque, modèle, matière, dimensions, composition, état, garantie… L&apos;assistant
            n&apos;invente rien : ce qui manque vous sera demandé.
          </p>
        </div>

        <div>
          <p className="label">Photos (facultatif, {MAX_AI_PHOTOS} maximum)</p>
          <div className="flex flex-wrap gap-3">
            {photos.map((p) => (
              <div key={p.path} className="relative size-24 overflow-hidden rounded-xl border border-line">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.url} alt="" className="size-full object-cover" />
                <button
                  type="button"
                  onClick={() => removePhoto(p.path)}
                  className="absolute top-1 right-1 grid size-6 place-items-center rounded-full bg-white/90 text-ink shadow"
                  aria-label="Retirer la photo"
                >
                  <X className="size-3.5" />
                </button>
              </div>
            ))}
            {photos.length < MAX_AI_PHOTOS ? (
              <button
                type="button"
                onClick={() => input.current?.click()}
                disabled={uploading}
                className="grid size-24 place-items-center rounded-xl border border-dashed border-line text-ink-soft transition hover:border-brand hover:text-brand"
              >
                {uploading ? <Loader2 className="size-5 animate-spin" /> : <ImagePlus className="size-5" />}
              </button>
            ) : null}
          </div>
          <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" multiple hidden onChange={(e) => onFiles(e.target.files)} />
          <p className="mt-1 text-xs text-ink-soft">Seuls les aspects visibles (couleur, style…) peuvent être repérés sur une photo, et restent à confirmer.</p>
          {photoError ? <p className="mt-1 text-sm text-danger">{photoError}</p> : null}
        </div>

        <div>
          <label className="label" htmlFor="categoryId">Catégorie</label>
          <CategorySelect categories={categories} featuredCount={featuredCount} optional />
        </div>

        <p className="flex items-start gap-2 rounded-xl bg-brand-soft px-3 py-2 text-xs text-ink">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-brand" />
          La fiche est créée en statut « À vérifier ». Chaque information indique sa source (déclarée par vous, observée sur la
          photo ou suggérée) et rien n&apos;est mis en vente sans votre validation.
        </p>

        {aiState?.error ? <p className="text-sm text-danger">{aiState.error}</p> : null}
        <div className="flex flex-wrap items-center gap-3">
          <Submit disabled={!aiReady || remaining === 0 || uploading}>
            <Sparkles className="size-4" /> Préparer la fiche
          </Submit>
          <span className="text-xs text-ink-soft">1 génération · {remaining} restante{remaining > 1 ? "s" : ""} ce mois-ci</span>
        </div>
      </form>
    </div>
  );
}
