"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getUser } from "@/lib/supabase/server";
import { SITE_URL } from "@/lib/supabase/env";
import { checkRateLimit } from "@/lib/rate-limit";
import { reportError } from "@/lib/observability";

export type FormState = { error?: string; success?: string } | undefined;

export async function updateProfile(_: FormState, formData: FormData): Promise<FormState> {
  const name = z.string().trim().min(2, "Indiquez votre nom.").max(100).safeParse(formData.get("fullName"));
  if (!name.success) return { error: name.error.issues[0].message };
  const { supabase, user } = await getUser();
  if (!user) return { error: "Session expirée." };
  const limited = await checkRateLimit(supabase, "write");
  if (limited) return { error: limited };
  const { data, error } = await supabase.from("profiles").update({ full_name: name.data }).eq("id", user.id).select("id");
  if (error || !data?.length) return { error: "Enregistrement impossible." };
  revalidatePath("/parametres");
  return { success: "Nom enregistré." };
}

export async function changeEmail(_: FormState, formData: FormData): Promise<FormState> {
  const email = z.string().trim().toLowerCase().email("Adresse e-mail invalide.").max(254).safeParse(formData.get("email"));
  if (!email.success) return { error: email.error.issues[0].message };
  const { supabase, user } = await getUser();
  if (!user) return { error: "Session expirée." };
  if (email.data === user.email?.toLowerCase()) return { error: "C'est déjà votre adresse actuelle." };
  const limited = await checkRateLimit(supabase, "team");
  if (limited) return { error: limited };
  const { error } = await supabase.auth.updateUser(
    { email: email.data },
    { emailRedirectTo: `${SITE_URL}/auth/confirmation?suite=/parametres` },
  );
  if (error) {
    if (error.message.toLowerCase().includes("already")) return { error: "Cette adresse est déjà utilisée par un autre compte." };
    if (error.message.toLowerCase().includes("rate limit")) return { error: "Trop de demandes. Réessayez dans quelques minutes." };
    await reportError("action", "changeEmail", error, { userId: user.id });
    return { error: "Le changement d'adresse n'a pas pu être demandé." };
  }
  return { success: `Un e-mail de confirmation a été envoyé. Le changement sera effectif après validation du lien (selon les réglages Supabase, l'ancienne adresse peut aussi devoir confirmer).` };
}

const passwordSchema = z
  .object({
    current: z.string().min(1, "Indiquez votre mot de passe actuel."),
    next: z.string().min(8, "Le nouveau mot de passe doit contenir au moins 8 caractères.").max(72),
    confirm: z.string(),
  })
  .refine((v) => v.next === v.confirm, { message: "Les deux nouveaux mots de passe ne correspondent pas." })
  .refine((v) => v.next !== v.current, { message: "Choisissez un mot de passe différent de l'actuel." });

export async function changePassword(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = passwordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { supabase, user } = await getUser();
  if (!user?.email) return { error: "Session expirée." };
  const limited = await checkRateLimit(supabase, "team");
  if (limited) return { error: limited };
  // Vérifie le mot de passe actuel avant toute modification.
  const check = await supabase.auth.signInWithPassword({ email: user.email, password: parsed.data.current });
  if (check.error) return { error: "Mot de passe actuel incorrect." };
  const { error } = await supabase.auth.updateUser({ password: parsed.data.next });
  if (error) {
    if (error.message.toLowerCase().includes("weak") || error.message.toLowerCase().includes("pwned"))
      return { error: "Ce mot de passe est trop faible ou connu dans des fuites de données. Choisissez-en un autre." };
    await reportError("action", "changePassword", error, { userId: user.id });
    return { error: "Le mot de passe n'a pas pu être modifié." };
  }
  return { success: "Mot de passe modifié." };
}

export async function signOutEverywhere() {
  const { supabase } = await getUser();
  await supabase.auth.signOut({ scope: "global" });
  redirect("/connexion");
}
