import "server-only";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "./env";

// Clé de service : contourne RLS. Utilisée UNIQUEMENT côté serveur,
// pour les opérations sensibles (quotas, crédits), après vérification de l'utilisateur.
const SERVICE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY ?? "").trim();

export const isAdminConfigured = () => Boolean(SUPABASE_URL && SERVICE_KEY);

export function createAdminClient() {
  if (!isAdminConfigured()) throw new Error("SUPABASE_SERVICE_ROLE_KEY manquante");
  return createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
