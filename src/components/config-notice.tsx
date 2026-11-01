import { isSupabaseConfigured } from "@/lib/supabase/env";

/** Bandeau affiché tant que Supabase n'est pas branché : aucune fausse connexion. */
export function ConfigNotice() {
  if (isSupabaseConfigured()) return null;
  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
      Supabase n&apos;est pas encore configuré. Ajoutez <code className="font-mono">NEXT_PUBLIC_SUPABASE_URL</code> et{" "}
      <code className="font-mono">NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</code> dans Vercel pour activer les comptes.
    </div>
  );
}
