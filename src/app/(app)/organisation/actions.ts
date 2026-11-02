"use server";

import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { CURRENT_BUSINESS_COOKIE, canManage, getCurrentBusiness } from "@/lib/business";
import { SECTORS } from "@/lib/config/business";
import { SITE_URL } from "@/lib/supabase/env";
import { reportError } from "@/lib/observability";
import { checkRateLimit } from "@/lib/rate-limit";

type Result = { error?: string; ok?: boolean };
export type InviteState = { error?: string; link?: string; email?: string } | undefined;
export type FormState = { error?: string; ok?: boolean } | undefined;

const COOKIE_OPTIONS = { httpOnly: true, sameSite: "lax" as const, secure: true, path: "/", maxAge: 60 * 60 * 24 * 365 };

/** Traduction des erreurs levées par les fonctions SQL d'équipe. */
function teamError(message: string | undefined) {
  const m = message ?? "";
  if (m.includes("member_limit")) return "Votre offre a atteint son nombre maximal de membres (invitations en attente comprises). Passez à une offre supérieure ou retirez un membre.";
  if (m.includes("business_limit")) return "Votre offre a atteint son nombre maximal de commerces. Passez à une offre supérieure pour en ajouter.";
  if (m.includes("already_member")) return "Cette personne fait déjà partie de l'organisation.";
  if (m.includes("last_owner")) return "Vous êtes le seul propriétaire : vous ne pouvez pas quitter l'organisation.";
  if (m.includes("owner_role_locked")) return "Le rôle d'un propriétaire ne peut pas être modifié.";
  if (m.includes("org_limit")) return "Nombre maximal d'organisations atteint.";
  if (m.includes("forbidden")) return "Vous n'avez pas les droits pour cette action.";
  if (m.includes("invitation_expired")) return "Cette invitation a expiré. Demandez-en une nouvelle.";
  if (m.includes("invitation_used")) return "Cette invitation a déjà été utilisée.";
  if (m.includes("invitation_email")) return "Cette invitation a été envoyée à une autre adresse e-mail. Connectez-vous avec cette adresse.";
  if (m.includes("invitation_invalid")) return "Invitation introuvable.";
  return "L'opération n'a pas pu aboutir. Réessayez.";
}

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

// ---------------------------------------------------------------------------
// Commerce actif
// ---------------------------------------------------------------------------
export async function switchBusiness(id: string): Promise<Result> {
  const { businesses } = await getCurrentBusiness();
  if (!businesses.some((b) => b.id === id)) return { error: "Commerce introuvable." };
  (await cookies()).set(CURRENT_BUSINESS_COOKIE, id, COOKIE_OPTIONS);
  revalidatePath("/", "layout");
  return { ok: true };
}

const newBusinessSchema = z.object({
  name: z.string().trim().min(1, "Indiquez le nom du commerce.").max(120),
  category: z.enum(SECTORS, { message: "Choisissez un secteur d'activité." }),
  organizationId: z.string().uuid(),
});

export async function createBusiness(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = newBusinessSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { supabase, user, businesses } = await getCurrentBusiness();
  if (!user) return { error: "Session expirée." };
  const limited = await checkRateLimit(supabase, "team");
  if (limited) return { error: limited };
  const role = businesses.find((b) => b.organization_id === parsed.data.organizationId)?.role;
  if (!canManage(role)) return { error: "Seuls le propriétaire et les administrateurs peuvent ajouter un commerce." };

  const { data, error } = await supabase
    .from("businesses")
    .insert({ owner_id: user.id, organization_id: parsed.data.organizationId, name: parsed.data.name, category: parsed.data.category })
    .select("id")
    .single();
  if (error || !data) {
    if (!error?.message.includes("business_limit")) await reportError("action", "createBusiness", error, { userId: user.id });
    return { error: teamError(error?.message) };
  }
  (await cookies()).set(CURRENT_BUSINESS_COOKIE, data.id, COOKIE_OPTIONS);
  revalidatePath("/", "layout");
  redirect("/mon-commerce");
}

// ---------------------------------------------------------------------------
// Organisation
// ---------------------------------------------------------------------------
export async function renameOrganization(_: FormState, formData: FormData): Promise<FormState> {
  const name = String(formData.get("name") ?? "").trim();
  if (!name || name.length > 120) return { error: "Nom invalide (120 caractères maximum)." };
  const { supabase, business, role } = await getCurrentBusiness();
  if (!business || !canManage(role)) return { error: "Vous n'avez pas les droits pour cette action." };
  const limited = await checkRateLimit(supabase, "team");
  if (limited) return { error: limited };
  const { data, error } = await supabase.from("organizations").update({ name }).eq("id", business.organization_id).select("id");
  if (error || !data?.length) return { error: "Enregistrement impossible." };
  revalidatePath("/organisation");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Équipe
// ---------------------------------------------------------------------------
const inviteSchema = z.object({
  email: z.string().trim().toLowerCase().email("Adresse e-mail invalide.").max(254),
  role: z.enum(["admin", "member"]),
});

export async function inviteMember(_: InviteState, formData: FormData): Promise<InviteState> {
  const parsed = inviteSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { supabase, user, business, role } = await getCurrentBusiness();
  if (!user || !business) return { error: "Session expirée." };
  if (!canManage(role)) return { error: "Vous n'avez pas les droits pour inviter." };
  if (parsed.data.role === "admin" && role !== "owner") return { error: "Seul le propriétaire peut inviter un administrateur." };
  const limited = await checkRateLimit(supabase, "team");
  if (limited) return { error: limited };

  // Le jeton n'est montré qu'une fois ; seule son empreinte est stockée.
  const token = randomBytes(32).toString("base64url");
  const { error } = await supabase.rpc("invite_member", {
    p_org: business.organization_id,
    p_email: parsed.data.email,
    p_role: parsed.data.role,
    p_token_hash: hashToken(token),
  });
  if (error) return { error: teamError(error.message) };
  revalidatePath("/organisation");
  return { link: `${SITE_URL}/invitation/${token}`, email: parsed.data.email };
}

export async function revokeInvitation(id: string): Promise<Result> {
  const { supabase } = await getCurrentBusiness();
  const { error } = await supabase.rpc("revoke_invitation", { p_id: id });
  if (error) return { error: teamError(error.message) };
  revalidatePath("/organisation");
  return { ok: true };
}

export async function changeRole(userId: string, newRole: "admin" | "member"): Promise<Result> {
  const { supabase, business } = await getCurrentBusiness();
  if (!business) return { error: "Session expirée." };
  const limited = await checkRateLimit(supabase, "team");
  if (limited) return { error: limited };
  const { error } = await supabase.rpc("update_member_role", { p_org: business.organization_id, p_user: userId, p_role: newRole });
  if (error) return { error: teamError(error.message) };
  revalidatePath("/organisation");
  return { ok: true };
}

export async function removeMember(userId: string): Promise<Result> {
  const { supabase, user, business } = await getCurrentBusiness();
  if (!user || !business) return { error: "Session expirée." };
  const limited = await checkRateLimit(supabase, "team");
  if (limited) return { error: limited };
  const { error } = await supabase.rpc("remove_member", { p_org: business.organization_id, p_user: userId });
  if (error) return { error: teamError(error.message) };
  if (userId === user.id) {
    (await cookies()).delete(CURRENT_BUSINESS_COOKIE);
    revalidatePath("/", "layout");
    redirect("/tableau-de-bord");
  }
  revalidatePath("/organisation");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Acceptation d'une invitation
// ---------------------------------------------------------------------------
export async function acceptInvitation(token: string): Promise<Result> {
  const { supabase, user } = await getCurrentBusiness();
  if (!user) return { error: "Connectez-vous pour accepter l'invitation." };
  const { data: orgId, error } = await supabase.rpc("accept_invitation", { p_token_hash: hashToken(token) });
  if (error) return { error: teamError(error.message) };
  const { data: first } = await supabase.from("businesses").select("id").eq("organization_id", orgId).order("created_at").limit(1).maybeSingle();
  if (first) (await cookies()).set(CURRENT_BUSINESS_COOKIE, first.id, COOKIE_OPTIONS);
  revalidatePath("/", "layout");
  redirect("/tableau-de-bord");
}

export async function previewInvitation(token: string) {
  const { supabase } = await getCurrentBusiness();
  const { data } = await supabase.rpc("invitation_preview", { p_token_hash: hashToken(token) });
  return data as { organization: string; role: "admin" | "member"; email_hint: string; status: "pending" | "used" | "expired"; email_matches: boolean } | null;
}
