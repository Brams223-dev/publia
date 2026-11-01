import "server-only";
// Suivi des erreurs : journal console (visible dans Vercel) + table app_errors (Supabase).
// Ne lève jamais d'exception : un échec d'enregistrement ne doit pas casser la requête.
// Ne journalise jamais de secret : jetons, clés et JWT sont masqués, les textes sont tronqués.

import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";

export type ErrorSource = "server" | "action" | "client";

const SECRET_PATTERNS = [
  /\bsk-[A-Za-z0-9_-]{10,}/g,
  /\bsb_(secret|publishable)_[A-Za-z0-9_-]{10,}/g,
  /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g,
  /\bBearer\s+[A-Za-z0-9._-]{10,}/gi,
  /\b(whsec|rk_live|sk_live|sk_test|pk_live)_[A-Za-z0-9]{8,}/g,
];

export function scrub(text: string, max = 1000) {
  let s = text;
  for (const re of SECRET_PATTERNS) s = s.replace(re, "[masqué]");
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

/** Résumé sûr d'une erreur quelconque (Error, erreur Supabase, valeur lancée). */
export function describeError(e: unknown): { message: string; digest?: string; code?: string } {
  if (e instanceof Error) {
    const digest = "digest" in e ? String((e as Error & { digest?: unknown }).digest) : undefined;
    const kind = "kind" in e ? String((e as Error & { kind?: unknown }).kind) : undefined;
    return { message: scrub(`${e.name}: ${e.message}`), digest, code: kind };
  }
  if (e && typeof e === "object") {
    const o = e as { message?: unknown; code?: unknown };
    return { message: scrub(String(o.message ?? JSON.stringify(e))), code: o.code ? String(o.code).slice(0, 40) : undefined };
  }
  return { message: scrub(String(e)) };
}

type Extra = { userId?: string | null; route?: string; context?: Record<string, string | number | boolean | null | undefined> };

/** Enregistre une erreur. `where` = l'endroit du code (« saveProduct », « generateProduct.insert »…). */
export async function reportError(source: ErrorSource, where: string, error: unknown, extra: Extra = {}) {
  const d = describeError(error);
  console.error(`[${where}]`, d.message, d.code ?? "", d.digest ?? "");
  if (!isAdminConfigured()) return;
  try {
    const context: Record<string, string | number | boolean> = { where };
    if (d.code) context.code = d.code;
    for (const [k, v] of Object.entries(extra.context ?? {})) {
      if (v === null || v === undefined) continue;
      context[k.slice(0, 40)] = typeof v === "string" ? scrub(v, 200) : v;
    }
    await createAdminClient()
      .from("app_errors")
      .insert({
        source,
        route: extra.route ? scrub(extra.route, 300) : null,
        message: d.message,
        digest: d.digest?.slice(0, 100) ?? null,
        user_id: extra.userId ?? null,
        context,
      });
  } catch (e) {
    console.error("[reportError] enregistrement impossible", e instanceof Error ? e.message : e);
  }
}
