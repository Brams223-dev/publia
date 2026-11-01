import type { Metadata } from "next";
import { canManage, getCurrentBusiness } from "@/lib/business";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { BusinessForm } from "./business-form";
import { BrandMedia } from "./brand-media";

export const metadata: Metadata = { title: "Mon commerce" };

const SIGNED_URL_TTL = 60 * 60; // 1 h

export default async function MyBusinessPage() {
  if (!isSupabaseConfigured()) return null;
  const { supabase, business, role } = await getCurrentBusiness();
  const editable = !business || canManage(role);

  let logoUrl: string | null = null;
  let photos: { id: string; url: string | null }[] = [];

  if (business) {
    if (business.logo_url) {
      const { data } = await supabase.storage.from("brand-assets").createSignedUrl(business.logo_url, SIGNED_URL_TTL);
      logoUrl = data?.signedUrl ?? null;
    }
    const { data: assets } = await supabase
      .from("brand_assets")
      .select("id, file_path")
      .eq("business_id", business.id)
      .eq("asset_type", "photo")
      .order("created_at", { ascending: false });
    if (assets?.length) {
      const { data: signed } = await supabase.storage
        .from("uploads")
        .createSignedUrls(assets.map((a) => a.file_path), SIGNED_URL_TTL);
      photos = assets.map((a, i) => ({ id: a.id, url: signed?.[i]?.signedUrl ?? null }));
    }
  }

  return (
    <div className="mt-4 space-y-6">
      <header>
        <h1 className="text-2xl font-semibold sm:text-3xl">Mon commerce</h1>
        <p className="mt-1 text-ink-soft">
          Ces informations personnalisent tous vos contenus. L&apos;IA n&apos;utilisera que ce que vous indiquez ici.
        </p>
      </header>

      {!editable ? (
        <p className="rounded-2xl border border-line bg-white px-4 py-3 text-sm text-ink-soft">
          <span className="font-semibold text-ink">Lecture seule : </span>seuls le propriétaire et les administrateurs de
          l&apos;organisation peuvent modifier ces informations.
        </p>
      ) : null}

      <fieldset disabled={!editable} className="min-w-0 space-y-6">
        <BusinessForm business={business} logoUrl={logoUrl} />
      </fieldset>

      {business ? (
        <fieldset disabled={!editable} className="min-w-0">
          <BrandMedia businessId={business.id} logoUrl={logoUrl} photos={photos} />
        </fieldset>
      ) : (
        <p className="card p-5 text-sm text-ink-soft">
          Enregistrez d&apos;abord votre commerce pour pouvoir importer votre logo et vos photos.
        </p>
      )}
    </div>
  );
}
