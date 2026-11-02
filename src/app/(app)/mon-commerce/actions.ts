"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { reportError } from "@/lib/observability";
import { cookies } from "next/headers";
import { CURRENT_BUSINESS_COOKIE, canManage, getCurrentBusiness } from "@/lib/business";
import { checkRateLimit } from "@/lib/rate-limit";
import { SECTORS, TONES, MAX_PHOTOS } from "@/lib/config/business";

export type SaveState = { error?: string; success?: string; fieldErrors?: Record<string, string> } | undefined;

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `${max} caractères maximum.`)
    .transform((v) => (v === "" ? null : v));

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Couleur invalide.");

const schema = z.object({
  name: z.string().trim().min(1, "Indiquez le nom du commerce.").max(120, "120 caractères maximum."),
  category: z.enum(SECTORS, { message: "Choisissez un secteur d'activité." }),
  description: optionalText(2000),
  address: optionalText(200),
  city: optionalText(100),
  phone: optionalText(30).refine((v) => v === null || /^[+\d][\d\s.\-()]{5,}$/.test(v), "Numéro de téléphone invalide."),
  website: optionalText(200).transform((v, ctx) => {
    if (v === null) return null;
    const withProtocol = /^https?:\/\//i.test(v) ? v : `https://${v}`;
    try {
      const u = new URL(withProtocol);
      if (!u.hostname.includes(".")) throw new Error();
      return u.toString().replace(/\/$/, "");
    } catch {
      ctx.addIssue({ code: "custom", message: "Adresse de site invalide." });
      return z.NEVER;
    }
  }),
  tone: z.enum(TONES.map((t) => t.id) as [string, ...string[]], { message: "Choisissez un ton." }),
  products: optionalText(2000),
  services: optionalText(2000),
  target_audience: optionalText(1000),
  opening_hours: optionalText(500),
  goals: optionalText(1000),
  social_instagram: optionalText(200),
  social_facebook: optionalText(200),
  social_tiktok: optionalText(200),
  social_youtube: optionalText(200),
  primary: hex,
  secondary: hex,
  text: hex,
});

export async function saveBusiness(_: SaveState, formData: FormData): Promise<SaveState> {
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "");
      if (key && !fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return { error: "Certains champs sont à corriger.", fieldErrors };
  }

  const { supabase, user, business, role } = await getCurrentBusiness();
  if (!user) return { error: "Votre session a expiré. Reconnectez-vous." };
  if (business && !canManage(role)) return { error: READ_ONLY };
  const limited = await checkRateLimit(supabase, "write");
  if (limited) return { error: limited };

  const { primary, secondary, text, social_instagram, social_facebook, social_tiktok, social_youtube, ...rest } = parsed.data;
  const social_links = Object.fromEntries(
    Object.entries({ instagram: social_instagram, facebook: social_facebook, tiktok: social_tiktok, youtube: social_youtube }).filter(([, v]) => v),
  );
  const row = { ...rest, social_links, brand_colors: { primary, secondary, text } };

  let error: { message: string; code?: string } | null = null;
  if (business) {
    const res = await supabase.from("businesses").update(row).eq("id", business.id).select("id");
    error = res.error ?? (res.data?.length ? null : { message: "aucune ligne modifiée" });
  } else {
    // Premier commerce : création de l'organisation dont l'utilisateur devient propriétaire.
    const { data: managed } = await supabase
      .from("organization_members")
      .select("organization_id")
      .eq("user_id", user.id)
      .in("role", ["owner", "admin"])
      .limit(1)
      .maybeSingle();
    let orgId: string | null = managed?.organization_id ?? null;
    if (!orgId) {
      const created = await supabase.rpc("create_organization", { p_name: row.name });
      error = created.error;
      orgId = created.data as string | null;
    }
    if (!error) {
      const res = await supabase.from("businesses").insert({ ...row, owner_id: user.id, organization_id: orgId }).select("id").single();
      error = res.error;
      if (res.data) (await cookies()).set(CURRENT_BUSINESS_COOKIE, res.data.id, COOKIE_OPTIONS);
    }
  }

  if (error) {
    await reportError("action", "saveBusiness", error, { userId: user.id });
    return { error: "Enregistrement impossible pour le moment. Réessayez." };
  }

  revalidatePath("/", "layout");
  return { success: business ? "Modifications enregistrées." : "Commerce créé. Vous pouvez maintenant ajouter votre logo et vos photos." };
}

const READ_ONLY = "Seuls le propriétaire et les administrateurs peuvent modifier les informations du commerce.";
const COOKIE_OPTIONS = { httpOnly: true, sameSite: "lax" as const, secure: true, path: "/", maxAge: 60 * 60 * 24 * 365 };

/** Vérifie qu'un chemin de stockage appartient bien au commerce de l'utilisateur. */
function ownsPath(path: string, businessId: string) {
  return path.startsWith(`${businessId}/`) && !path.includes("..");
}

export async function setLogo(path: string): Promise<{ error?: string }> {
  const { supabase, user, business, role } = await getCurrentBusiness();
  if (!user || !business) return { error: "Commerce introuvable." };
  if (!canManage(role)) return { error: READ_ONLY };
  const limited = await checkRateLimit(supabase, "upload");
  if (limited) return { error: limited };
  if (!ownsPath(path, business.id)) return { error: "Fichier non autorisé." };

  const previous = business.logo_url;
  const { error } = await supabase.from("businesses").update({ logo_url: path }).eq("id", business.id);
  if (error) return { error: "Impossible d'enregistrer le logo." };
  if (previous && previous !== path) await supabase.storage.from("brand-assets").remove([previous]);

  revalidatePath("/", "layout");
  return {};
}

export async function removeLogo(): Promise<{ error?: string }> {
  const { supabase, user, business, role } = await getCurrentBusiness();
  if (!user || !business) return { error: "Commerce introuvable." };
  if (!canManage(role)) return { error: READ_ONLY };
  if (business.logo_url) await supabase.storage.from("brand-assets").remove([business.logo_url]);
  const { error } = await supabase.from("businesses").update({ logo_url: null }).eq("id", business.id);
  if (error) return { error: "Impossible de retirer le logo." };
  revalidatePath("/", "layout");
  return {};
}

export async function addPhoto(path: string): Promise<{ error?: string }> {
  const { supabase, user, business } = await getCurrentBusiness();
  if (!user || !business) return { error: "Commerce introuvable." };
  const limited = await checkRateLimit(supabase, "upload");
  if (limited) return { error: limited };
  if (!ownsPath(path, business.id)) return { error: "Fichier non autorisé." };

  const { count } = await supabase
    .from("brand_assets")
    .select("id", { count: "exact", head: true })
    .eq("business_id", business.id)
    .eq("asset_type", "photo");
  if ((count ?? 0) >= MAX_PHOTOS) {
    await supabase.storage.from("uploads").remove([path]);
    return { error: `Maximum ${MAX_PHOTOS} photos. Supprimez-en une avant d'en ajouter.` };
  }

  const { error } = await supabase
    .from("brand_assets")
    .insert({ business_id: business.id, file_path: path, asset_type: "photo" });
  if (error) return { error: "Impossible d'enregistrer la photo." };
  revalidatePath("/mon-commerce");
  return {};
}

export async function deletePhoto(id: string): Promise<{ error?: string }> {
  const { supabase, user, business } = await getCurrentBusiness();
  if (!user || !business) return { error: "Commerce introuvable." };
  const { data } = await supabase
    .from("brand_assets")
    .select("file_path")
    .eq("id", id)
    .eq("business_id", business.id)
    .maybeSingle();
  if (!data) return { error: "Photo introuvable." };
  await supabase.storage.from("uploads").remove([data.file_path]);
  await supabase.from("brand_assets").delete().eq("id", id);
  revalidatePath("/mon-commerce");
  return {};
}
