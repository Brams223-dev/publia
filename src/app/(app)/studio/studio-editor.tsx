"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Check, Download, ImagePlus, Save } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { saveCreation } from "./actions";
import { STUDIO_FORMATS, TEMPLATE_CATEGORIES, formatById, type StudioFormat } from "@/lib/studio/formats";
import { TEMPLATES, renderVisual, templateById, type Img, type LogoPosition, type RenderParams } from "@/lib/studio/render";

export type StudioPhoto = { path: string; url: string };
export type StudioInitial = {
  format: StudioFormat;
  templateId: string;
  title: string;
  subtitle: string;
  badge: string;
  cta: string;
  colors: { primary: string; secondary: string; text: string };
  photoPath: string | null;
  zoom: number;
  x: number;
  y: number;
  logoPosition: LogoPosition | "auto";
  postId: string | null;
};

function useImage(src: string | null) {
  const [loaded, setLoaded] = useState<{ src: string; img: Img | null } | null>(null);
  useEffect(() => {
    if (!src) return;
    let alive = true;
    const el = new Image();
    if (!src.startsWith("blob:")) el.crossOrigin = "anonymous";
    el.onload = () => alive && setLoaded({ src, img: el });
    el.onerror = () => alive && setLoaded({ src, img: null });
    el.src = src;
    return () => {
      alive = false;
    };
  }, [src]);
  // Ne renvoie l'image que si elle correspond à la source demandée.
  return src && loaded?.src === src ? loaded.img : null;
}

const LOGO_POSITIONS: { id: LogoPosition | "auto"; label: string }[] = [
  { id: "auto", label: "Auto" },
  { id: "tl", label: "↖" },
  { id: "tr", label: "↗" },
  { id: "bl", label: "↙" },
  { id: "br", label: "↘" },
  { id: "none", label: "Aucun" },
];

export function StudioEditor({
  businessId,
  logoUrl,
  photos,
  initial,
}: {
  businessId: string;
  logoUrl: string | null;
  photos: StudioPhoto[];
  initial: StudioInitial;
}) {
  const [s, setS] = useState(initial);
  const set = <K extends keyof StudioInitial>(k: K, v: StudioInitial[K]) => setS((o) => ({ ...o, [k]: v }));
  const [category, setCategory] = useState<string>(templateById(initial.templateId).category);
  const [localPhoto, setLocalPhoto] = useState<string | null>(null);
  const [fontsReady, setFontsReady] = useState(false);
  const [status, setStatus] = useState<{ error?: string; success?: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fmt = formatById(s.format);
  const tpl = templateById(s.templateId);

  const photoUrl = localPhoto ?? photos.find((p) => p.path === s.photoPath)?.url ?? null;
  const photoImg = useImage(photoUrl);
  const logoImg = useImage(logoUrl);

  useEffect(() => {
    Promise.all([document.fonts.load(`800 40px "Inter Variable"`), document.fonts.load(`500 40px "Inter Variable"`)])
      .catch(() => {})
      .finally(() => setFontsReady(true));
  }, []);

  const params = useMemo<RenderParams>(
    () => ({
      title: s.title,
      subtitle: s.subtitle,
      badge: s.badge,
      cta: s.cta,
      colors: s.colors,
      photo: { img: photoImg, zoom: s.zoom, x: s.x, y: s.y },
      logo: { img: logoImg, position: s.logoPosition === "auto" ? tpl.logo : s.logoPosition },
    }),
    [s, photoImg, logoImg, tpl.logo],
  );

  useEffect(() => {
    if (!fontsReady || !canvasRef.current) return;
    const id = requestAnimationFrame(() => renderVisual(canvasRef.current!, fmt.width, fmt.height, s.templateId, params));
    return () => cancelAnimationFrame(id);
  }, [params, fmt.width, fmt.height, s.templateId, fontsReady]);

  const toBlob = useCallback(
    (type: "image/png" | "image/jpeg") =>
      new Promise<Blob>((resolve, reject) => {
        const c = canvasRef.current;
        if (!c) return reject(new Error("canvas"));
        try {
          c.toBlob((b) => (b ? resolve(b) : reject(new Error("blob"))), type, 0.92);
        } catch (e) {
          reject(e);
        }
      }),
    [],
  );

  async function download(type: "image/png" | "image/jpeg") {
    setStatus(null);
    try {
      const blob = await toBlob(type);
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `publia-${s.templateId}-${fmt.width}x${fmt.height}.${type === "image/png" ? "png" : "jpg"}`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    } catch {
      setStatus({ error: "Export impossible : une image n'a pas pu être lue. Réessayez avec une autre photo." });
    }
  }

  async function save() {
    setStatus(null);
    setSaving(true);
    try {
      const blob = await toBlob("image/png");
      const path = `${businessId}/creations/${crypto.randomUUID()}.png`;
      const supabase = createClient();
      const { error } = await supabase.storage.from("uploads").upload(path, blob, { contentType: "image/png" });
      if (error) throw error;
      const res = await saveCreation({
        path,
        format: s.format,
        templateId: s.templateId,
        title: s.title.slice(0, 200),
        mimeType: "image/png",
        postId: s.postId,
        params: {
          title: s.title,
          subtitle: s.subtitle,
          badge: s.badge,
          cta: s.cta,
          colors: s.colors,
          photoPath: localPhoto ? null : s.photoPath,
          zoom: s.zoom,
          x: s.x,
          y: s.y,
          logoPosition: s.logoPosition,
        },
      });
      setStatus(res.error ? { error: res.error } : { success: "Visuel enregistré dans la bibliothèque." });
    } catch {
      setStatus({ error: "Enregistrement impossible. Vérifiez votre connexion et réessayez." });
    } finally {
      setSaving(false);
    }
  }

  function importPhoto(file: File | undefined) {
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) return setStatus({ error: "Format non pris en charge : PNG, JPG ou WebP." });
    if (file.size > 15 * 1024 * 1024) return setStatus({ error: "Photo trop lourde (15 Mo maximum)." });
    setLocalPhoto(URL.createObjectURL(file));
    setS((o) => ({ ...o, zoom: 1, x: 0, y: 0 }));
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
      {/* Aperçu */}
      <div className="order-1 min-w-0 lg:order-2 lg:sticky lg:top-8 lg:self-start">
        <div className="card flex items-center justify-center bg-canvas p-3 sm:p-4">
          <canvas
            ref={canvasRef}
            className="block h-auto min-w-0 max-h-[62vh] w-auto max-w-full rounded-lg shadow-[0_8px_30px_rgb(37_36_58/0.15)]"
            style={{ aspectRatio: `${fmt.width} / ${fmt.height}` }}
            aria-label="Aperçu du visuel"
          />
        </div>
        <p className="mt-2 text-center text-xs text-ink-soft">
          {fmt.label} · {fmt.width} × {fmt.height} px
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button type="button" className="btn-ghost" onClick={() => download("image/png")}>
            <Download className="size-4" /> PNG
          </button>
          <button type="button" className="btn-ghost" onClick={() => download("image/jpeg")}>
            <Download className="size-4" /> JPG
          </button>
          <button type="button" className="btn-primary col-span-2 py-3" onClick={save} disabled={saving}>
            <Save className="size-4" /> {saving ? "Enregistrement…" : "Enregistrer dans la bibliothèque"}
          </button>
        </div>
        {status?.error && <p role="alert" className="mt-3 rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">{status.error}</p>}
        {status?.success && (
          <p role="status" className="mt-3 flex items-center gap-2 rounded-xl bg-success/10 px-3 py-2 text-sm text-success">
            <Check className="size-4" /> {status.success}{" "}
            <Link href="/bibliotheque" className="ml-auto font-semibold underline">Voir</Link>
          </p>
        )}
      </div>

      {/* Réglages */}
      <div className="order-2 min-w-0 space-y-5 lg:order-1">
        <section className="card p-5">
          <h2 className="font-semibold">Format</h2>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
            {STUDIO_FORMATS.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => set("format", f.id)}
                className={`rounded-xl border px-2 py-2.5 text-center text-xs transition ${s.format === f.id ? "border-brand bg-brand-soft font-semibold text-brand" : "border-line bg-white hover:border-brand-light"}`}
              >
                <span className="block text-sm">{f.short}</span>
                {f.label}
              </button>
            ))}
          </div>
        </section>

        <section className="card p-5">
          <h2 className="font-semibold">Modèle</h2>
          <div className="mt-3 flex gap-1.5 overflow-x-auto pb-1">
            {TEMPLATE_CATEGORIES.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setCategory(c.id)}
                className={`shrink-0 rounded-full px-3 py-1.5 text-sm ${category === c.id ? "bg-brand text-white" : "bg-canvas text-ink-soft hover:text-ink"}`}
              >
                {c.label}
              </button>
            ))}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3">
            {TEMPLATES.filter((t) => t.category === category).map((t) => (
              <TemplateThumb key={t.id} id={t.id} name={t.name} active={s.templateId === t.id} params={params} format={s.format} ready={fontsReady} onPick={() => set("templateId", t.id)} />
            ))}
          </div>
        </section>

        <section className="card space-y-3 p-5">
          <h2 className="font-semibold">Textes</h2>
          <div>
            <label className="label" htmlFor="st-title">Titre</label>
            <textarea id="st-title" rows={2} maxLength={120} className="input resize-y" value={s.title} onChange={(e) => set("title", e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="st-sub">Sous-titre</label>
            <input id="st-sub" maxLength={140} className="input" value={s.subtitle} onChange={(e) => set("subtitle", e.target.value)} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="st-badge">Badge</label>
              <input id="st-badge" maxLength={30} className="input" placeholder="Ex. : Nouveau, Samedi 8 nov." value={s.badge} onChange={(e) => set("badge", e.target.value)} />
            </div>
            <div>
              <label className="label" htmlFor="st-cta">Appel à l&apos;action</label>
              <input id="st-cta" maxLength={40} className="input" value={s.cta} onChange={(e) => set("cta", e.target.value)} />
            </div>
          </div>
          <p className="text-xs text-ink-soft">Ne mentionnez un prix ou une offre que s&apos;ils sont réels.</p>
        </section>

        {tpl.usesPhoto && (
          <section className="card space-y-3 p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-semibold">Photo</h2>
              <label className="btn-ghost cursor-pointer px-4 py-2">
                <ImagePlus className="size-4" /> Importer
                <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(e) => importPhoto(e.target.files?.[0])} />
              </label>
            </div>
            {photos.length > 0 ? (
              <div className="grid grid-cols-5 gap-2">
                {photos.map((p) => (
                  <button
                    key={p.path}
                    type="button"
                    onClick={() => {
                      setLocalPhoto(null);
                      setS((o) => ({ ...o, photoPath: p.path, zoom: 1, x: 0, y: 0 }));
                    }}
                    className={`aspect-square overflow-hidden rounded-lg ring-2 ${!localPhoto && s.photoPath === p.path ? "ring-brand" : "ring-transparent"}`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.url} alt="" className="size-full object-cover" />
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-sm text-ink-soft">
                Importez une photo, ou ajoutez-en dans <Link href="/mon-commerce" className="font-semibold text-brand">Mon commerce</Link> pour les réutiliser.
              </p>
            )}
            {photoUrl && (
              <div className="space-y-2 pt-1">
                {([
                  ["zoom", "Zoom", 1, 3],
                  ["x", "Cadrage horizontal", -1, 1],
                  ["y", "Cadrage vertical", -1, 1],
                ] as const).map(([k, label, min, max]) => (
                  <label key={k} className="flex items-center gap-3 text-sm">
                    <span className="w-36 shrink-0 text-ink-soft">{label}</span>
                    <input type="range" min={min} max={max} step={0.01} value={s[k]} onChange={(e) => set(k, Number(e.target.value))} className="w-full accent-brand" />
                  </label>
                ))}
              </div>
            )}
          </section>
        )}

        <section className="card space-y-4 p-5">
          <h2 className="font-semibold">Marque</h2>
          <div className="grid grid-cols-3 gap-3">
            {(["primary", "secondary", "text"] as const).map((k) => (
              <label key={k} className="text-sm">
                <span className="mb-1 block text-ink-soft">{{ primary: "Principale", secondary: "Secondaire", text: "Texte" }[k]}</span>
                <input type="color" value={s.colors[k]} onChange={(e) => set("colors", { ...s.colors, [k]: e.target.value })} className="h-10 w-full cursor-pointer rounded-lg border border-line bg-white p-1" />
              </label>
            ))}
          </div>
          <div>
            <p className="mb-1.5 text-sm text-ink-soft">Logo {logoUrl ? "" : "(ajoutez-le dans Mon commerce)"}</p>
            <div className="flex flex-wrap gap-1.5">
              {LOGO_POSITIONS.map((l) => (
                <button
                  key={l.id}
                  type="button"
                  disabled={!logoUrl}
                  onClick={() => set("logoPosition", l.id)}
                  className={`min-w-11 rounded-lg border px-3 py-2 text-sm disabled:opacity-40 ${s.logoPosition === l.id ? "border-brand bg-brand-soft font-semibold text-brand" : "border-line bg-white"}`}
                >
                  {l.label}
                </button>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function TemplateThumb({
  id,
  name,
  active,
  params,
  format,
  ready,
  onPick,
}: {
  id: string;
  name: string;
  active: boolean;
  params: RenderParams;
  format: StudioFormat;
  ready: boolean;
  onPick: () => void;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const f = formatById(format);
  useEffect(() => {
    if (!ready || !ref.current) return;
    const scale = 320 / Math.max(f.width, f.height);
    const t = setTimeout(() => {
      if (ref.current) renderVisual(ref.current, Math.round(f.width * scale), Math.round(f.height * scale), id, params);
    }, 120);
    return () => clearTimeout(t);
  }, [ready, params, f.width, f.height, id]);
  return (
    <button type="button" onClick={onPick} className={`rounded-xl border p-2 text-left transition ${active ? "border-brand bg-brand-soft" : "border-line bg-white hover:border-brand-light"}`}>
      <span className="flex aspect-square items-center justify-center rounded-lg bg-canvas">
        <canvas ref={ref} className="max-h-full max-w-full rounded" style={{ aspectRatio: `${f.width} / ${f.height}` }} />
      </span>
      <span className={`mt-1.5 block text-xs ${active ? "font-semibold text-brand" : "text-ink-soft"}`}>{name}</span>
    </button>
  );
}
