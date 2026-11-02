import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { reportError } from "@/lib/observability";

// Limites par utilisateur (fenêtre fixe). Calibrées pour un usage normal très confortable :
// elles ne freinent que les automatisations abusives ou les clics en boucle.
export const LIMITS = {
  ai: { limit: 10, window: 60, message: "Trop de générations rapprochées. Patientez une minute." },
  write: { limit: 120, window: 60, message: "Trop d'enregistrements rapprochés. Patientez quelques secondes." },
  upload: { limit: 60, window: 60, message: "Trop d'envois de fichiers rapprochés. Patientez une minute." },
  team: { limit: 30, window: 3600, message: "Trop d'opérations d'équipe en une heure. Réessayez plus tard." },
} as const;
export type Bucket = keyof typeof LIMITS;

/**
 * Renvoie un message d'erreur si la limite est dépassée, sinon null.
 * En cas de panne du limiteur, l'action est autorisée (les quotas et la RLS restent appliqués).
 */
export async function checkRateLimit(supabase: SupabaseClient, bucket: Bucket): Promise<string | null> {
  const cfg = LIMITS[bucket];
  const { data, error } = await supabase.rpc("rate_limit_hit", { p_bucket: bucket, p_limit: cfg.limit, p_window_seconds: cfg.window });
  if (error) {
    await reportError("server", "rateLimit", error, { context: { bucket } });
    return null;
  }
  return data === false ? cfg.message : null;
}
