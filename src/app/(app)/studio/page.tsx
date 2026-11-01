import type { Metadata } from "next";
import Link from "next/link";
import { Palette } from "lucide-react";
import { getCurrentBusiness } from "@/lib/business";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { formatForPost, STUDIO_FORMATS, type StudioFormat } from "@/lib/studio/formats";
import { TEMPLATES } from "@/lib/studio/render";
import { StudioEditor, type StudioInitial, type StudioPhoto } from "./studio-editor";

export const metadata: Metadata = { title: "Studio créatif" };

const TTL = 60 * 60;
const isUuid = (v?: string) => !!v && /^[0-9a-f-]{36}$/i.test(v);

export default async function StudioPage({ searchParams }: { searchParams: Promise<{ post?: string; creation?: string }> }) {
  if (!isSupabaseConfigured()) return null;
  const sp = await searchParams;
  const { supabase, business } = await getCurrentBusiness();

  if (!business)
    return (
      <div className="mt-4 card p-6">
        <p className="font-semibold">Présentez d&apos;abord votre commerce</p>
        <p className="mt-1 text-sm text-ink-soft">Le Studio utilise votre logo, vos couleurs et vos photos.</p>
        <Link href="/mon-commerce" className="btn-primary mt-4">Renseigner mon commerce</Link>
      </div>
    );

  const [{ data: logo }, { data: assets }] = await Promise.all([
    business.logo_url
      ? supabase.storage.from("brand-assets").createSignedUrl(business.logo_url, TTL)
      : Promise.resolve({ data: null as { signedUrl: string } | null }),
    supabase.from("brand_assets").select("file_path").eq("business_id", business.id).eq("asset_type", "photo").order("created_at", { ascending: false }).limit(30),
  ]);

  let photos: StudioPhoto[] = [];
  if (assets?.length) {
    const { data: signed } = await supabase.storage.from("uploads").createSignedUrls(assets.map((a) => a.file_path), TTL);
    photos = assets.map((a, i) => ({ path: a.file_path, url: signed?.[i]?.signedUrl ?? "" })).filter((p) => p.url);
  }

  let initial: StudioInitial = {
    format: "ig_portrait",
    templateId: TEMPLATES[0].id,
    title: business.name,
    subtitle: business.city ? `À ${business.city}` : "",
    badge: "",
    cta: "",
    colors: business.brand_colors,
    photoPath: photos[0]?.path ?? null,
    zoom: 1,
    x: 0,
    y: 0,
    logoPosition: "auto",
    postId: null,
  };

  // Réutiliser un visuel de la bibliothèque.
  if (isUuid(sp.creation)) {
    const { data: c } = await supabase.from("creations").select("format, template_id, params, post_id").eq("id", sp.creation!).maybeSingle();
    const p = c?.params as Partial<StudioInitial> | undefined;
    if (c && p) {
      initial = {
        ...initial,
        ...p,
        format: (STUDIO_FORMATS.some((f) => f.id === c.format) ? c.format : initial.format) as StudioFormat,
        templateId: c.template_id ?? initial.templateId,
        photoPath: p.photoPath && photos.some((x) => x.path === p.photoPath) ? p.photoPath : initial.photoPath,
        postId: c.post_id,
      };
    }
  }

  // Créer le visuel d'un contenu de campagne.
  if (isUuid(sp.post)) {
    const { data: post } = await supabase.from("posts").select("id, platform, format, title, short_caption, call_to_action").eq("id", sp.post!).maybeSingle();
    if (post) {
      initial = {
        ...initial,
        format: formatForPost(post.platform, post.format),
        templateId: post.platform === "youtube" ? "nouveau-badge" : initial.templateId,
        title: post.title ?? initial.title,
        subtitle: (post.short_caption ?? "").slice(0, 140),
        cta: (post.call_to_action ?? "").slice(0, 40),
        postId: post.id,
      };
    }
  }

  return (
    <div className="mt-4 space-y-6">
      <header className="flex items-start gap-4">
        <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-brand text-white">
          <Palette className="size-6" />
        </span>
        <div>
          <h1 className="text-2xl font-semibold sm:text-3xl">Studio créatif</h1>
          <p className="mt-1 text-ink-soft">
            Choisissez un modèle, votre photo et vos textes : vos visuels sont prêts pour chaque réseau, à vos couleurs.
          </p>
        </div>
      </header>
      <StudioEditor businessId={business.id} logoUrl={logo?.signedUrl ?? null} photos={photos} initial={initial} />
    </div>
  );
}
