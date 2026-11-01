// Clés publiques uniquement. La clé service_role n'est JAMAIS lue côté client.
const clean = (v: string | undefined) => (v ?? "").trim().replace(/^["']|["']$/g, "").replace(/\/+$/, "");

export const SUPABASE_URL = clean(process.env.NEXT_PUBLIC_SUPABASE_URL);
export const SUPABASE_PUBLIC_KEY = clean(
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);

function isValidUrl(value: string) {
  try {
    const u = new URL(value);
    return u.protocol === "https:" || u.hostname === "localhost" || u.hostname === "127.0.0.1";
  } catch {
    return false;
  }
}

/** Liste des problèmes de configuration, en français, pour le bandeau d'aide. */
export function supabaseConfigIssues(): string[] {
  const issues: string[] = [];
  if (!SUPABASE_URL) issues.push("NEXT_PUBLIC_SUPABASE_URL est absente.");
  else if (!isValidUrl(SUPABASE_URL))
    issues.push("NEXT_PUBLIC_SUPABASE_URL n'est pas une adresse valide (attendu : https://xxxx.supabase.co).");
  if (!SUPABASE_PUBLIC_KEY) issues.push("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY est absente.");
  return issues;
}

export const isSupabaseConfigured = () => supabaseConfigIssues().length === 0;

export const SITE_URL = clean(
  process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : "http://localhost:3000"),
);
