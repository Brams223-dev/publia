"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentBusiness } from "@/lib/business";
import { STUDIO_FORMATS } from "@/lib/studio/formats";
import { TEMPLATES } from "@/lib/studio/render";

const saveSchema = z.object({
  path: z.string().min(10).max(300),
  format: z.enum(STUDIO_FORMATS.map((f) => f.id) as [string, ...string[]]),
  templateId: z.enum(TEMPLATES.map((t) => t.id) as [string, ...string[]]),
  title: z.string().trim().max(200),
  mimeType: z.enum(["image/png", "image/jpeg"]),
  postId: z.string().uuid().nullable(),
  params: z.object({
    title: z.string().max(300),
    subtitle: z.string().max(300),
    badge: z.string().max(60),
    cta: z.string().max(80),
    colors: z.object({ primary: z.string().regex(/^#[0-9a-fA-F]{6}$/), secondary: z.string().regex(/^#[0-9a-fA-F]{6}$/), text: z.string().regex(/^#[0-9a-fA-F]{6}$/) }),
    photoPath: z.string().max(300).nullable(),
    zoom: z.number().min(1).max(3),
    x: z.number().min(-1).max(1),
    y: z.number().min(-1).max(1),
    logoPosition: z.enum(["auto", "tl", "tr", "bl", "br", "none"]),
  }),
});

export async function saveCreation(input: z.input<typeof saveSchema>): Promise<{ error?: string; id?: string }> {
  const parsed = saveSchema.safeParse(input);
  if (!parsed.success) return { error: "Données invalides." };
  const d = parsed.data;
  const { supabase, user, business } = await getCurrentBusiness();
  if (!user || !business) return { error: "Commerce introuvable." };
  if (!d.path.startsWith(`${business.id}/creations/`) || d.path.includes("..")) return { error: "Fichier non autorisé." };
  if (d.params.photoPath && !d.params.photoPath.startsWith(`${business.id}/`)) d.params.photoPath = null;

  const f = STUDIO_FORMATS.find((x) => x.id === d.format)!;
  const { data, error } = await supabase
    .from("creations")
    .insert({
      business_id: business.id,
      post_id: d.postId,
      kind: d.format === "yt_thumbnail" ? "thumbnail" : "visual",
      format: d.format,
      template_id: d.templateId,
      title: d.title || null,
      file_path: d.path,
      mime_type: d.mimeType,
      width: f.width,
      height: f.height,
      params: d.params,
    })
    .select("id")
    .single();
  if (error || !data) {
    await supabase.storage.from("uploads").remove([d.path]);
    return { error: "Enregistrement impossible." };
  }
  revalidatePath("/bibliotheque");
  return { id: data.id };
}

export async function deleteCreation(id: string): Promise<{ error?: string }> {
  if (!z.string().uuid().safeParse(id).success) return { error: "Visuel introuvable." };
  const { supabase, user, business } = await getCurrentBusiness();
  if (!user || !business) return { error: "Commerce introuvable." };
  const { data } = await supabase.from("creations").select("file_path").eq("id", id).maybeSingle();
  if (!data) return { error: "Visuel introuvable." };
  await supabase.storage.from("uploads").remove([data.file_path]);
  await supabase.from("creations").delete().eq("id", id);
  revalidatePath("/bibliotheque");
  return {};
}
