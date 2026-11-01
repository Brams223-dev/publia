import { supabaseConfigIssues } from "@/lib/supabase/env";

/** Bandeau affiché tant que Supabase n'est pas correctement branché : aucune fausse connexion. */
export function ConfigNotice() {
  const issues = supabaseConfigIssues();
  if (issues.length === 0) return null;
  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
      <p className="font-semibold">Les comptes ne sont pas encore activés : configuration Supabase à corriger dans Vercel.</p>
      <ul className="mt-1 list-disc pl-5">
        {issues.map((i) => (
          <li key={i}>{i}</li>
        ))}
      </ul>
    </div>
  );
}
