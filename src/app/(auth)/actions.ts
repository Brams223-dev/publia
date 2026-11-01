"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { SITE_URL, isSupabaseConfigured } from "@/lib/supabase/env";

export type FormState = { error?: string; success?: string } | undefined;

const email = z.string().trim().email("Adresse email invalide.");
const password = z.string().min(8, "Le mot de passe doit contenir au moins 8 caractères.");

const NOT_CONFIGURED: FormState = {
  error: "Les comptes ne sont pas encore activés : Supabase n'est pas configuré.",
};

function safeNext(value: FormDataEntryValue | null) {
  const v = typeof value === "string" ? value : "";
  return v.startsWith("/") && !v.startsWith("//") ? v : "/tableau-de-bord";
}

function frenchAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login")) return "Email ou mot de passe incorrect.";
  if (m.includes("email not confirmed")) return "Confirmez d'abord votre adresse email (vérifiez votre boîte de réception).";
  if (m.includes("already registered")) return "Un compte existe déjà avec cet email.";
  if (m.includes("rate limit")) return "Trop de tentatives. Réessayez dans quelques minutes.";
  if (m.includes("same password")) return "Choisissez un mot de passe différent de l'ancien.";
  return "Une erreur est survenue. Réessayez.";
}

export async function signIn(_: FormState, formData: FormData): Promise<FormState> {
  if (!isSupabaseConfigured()) return NOT_CONFIGURED;
  const parsed = z.object({ email, password: z.string().min(1, "Mot de passe requis.") }).safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { error: frenchAuthError(error.message) };
  redirect(safeNext(formData.get("suite")));
}

export async function signUp(_: FormState, formData: FormData): Promise<FormState> {
  if (!isSupabaseConfigured()) return NOT_CONFIGURED;
  const parsed = z
    .object({
      fullName: z.string().trim().min(2, "Indiquez votre nom.").max(100),
      email,
      password,
      terms: z.literal("on", { message: "Acceptez les conditions d'utilisation pour continuer." }),
    })
    .safeParse({
      fullName: formData.get("fullName"),
      email: formData.get("email"),
      password: formData.get("password"),
      terms: formData.get("terms"),
    });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const next = safeNext(formData.get("suite"));
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { full_name: parsed.data.fullName },
      emailRedirectTo: `${SITE_URL}/auth/confirmation?suite=${encodeURIComponent(next)}`,
    },
  });
  if (error) return { error: frenchAuthError(error.message) };
  if (data.session) redirect(next);
  return { success: "Compte créé. Un email de confirmation vient de vous être envoyé." };
}

export async function forgotPassword(_: FormState, formData: FormData): Promise<FormState> {
  if (!isSupabaseConfigured()) return NOT_CONFIGURED;
  const parsed = email.safeParse(formData.get("email"));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(parsed.data, {
    redirectTo: `${SITE_URL}/auth/confirmation?suite=/reinitialisation`,
  });
  // Réponse identique que le compte existe ou non (pas d'énumération des emails).
  return { success: "Si un compte existe avec cet email, un lien de réinitialisation vient d'être envoyé." };
}

export async function resetPassword(_: FormState, formData: FormData): Promise<FormState> {
  if (!isSupabaseConfigured()) return NOT_CONFIGURED;
  const parsed = z
    .object({ password, confirm: z.string() })
    .refine((d) => d.password === d.confirm, { message: "Les deux mots de passe ne correspondent pas." })
    .safeParse({ password: formData.get("password"), confirm: formData.get("confirm") });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { error: frenchAuthError(error.message) };
  redirect("/tableau-de-bord");
}

export async function signOut() {
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }
  redirect("/connexion");
}
