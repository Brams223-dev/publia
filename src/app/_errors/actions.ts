"use server";

import { getUser } from "@/lib/supabase/server";
import { reportError } from "@/lib/observability";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";

const HOURLY_LIMIT = 20;

/** Erreur survenue dans le navigateur. Enregistrée seulement pour un utilisateur connecté, avec un plafond horaire. */
export async function logClientError(input: { message: string; digest?: string; route: string }) {
  const { user } = await getUser().catch(() => ({ user: null }));
  const message = String(input.message ?? "").slice(0, 500);
  if (!user || !isAdminConfigured()) {
    console.error("[client]", message, input.digest ?? "");
    return;
  }
  const since = new Date(Date.now() - 3600_000).toISOString();
  const { count } = await createAdminClient()
    .from("app_errors")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("source", "client")
    .gte("created_at", since);
  if ((count ?? 0) >= HOURLY_LIMIT) return;
  const err = Object.assign(new Error(message), { digest: input.digest?.slice(0, 100) });
  await reportError("client", "navigateur", err, { userId: user.id, route: String(input.route ?? "").split("?")[0].slice(0, 300) });
}
