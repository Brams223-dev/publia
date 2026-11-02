import "server-only";
// Enregistrement des consommations réelles chez les fournisseurs (table provider_usage).
// Best effort : un échec d'enregistrement est journalisé mais n'interrompt jamais l'action.

import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { reportError } from "@/lib/observability";

export type Meter = { operation: string; businessId?: string | null; userId?: string | null };

export type UsageRecord = Meter & {
  category: "ai" | "payment_fees" | "ad_spend" | "shipping" | "domain" | "other";
  provider: string;
  model?: string | null;
  status: "ok" | "error";
  inputTokens?: number;
  cachedInputTokens?: number;
  outputTokens?: number;
  images?: number;
  seconds?: number;
  amountCents?: number | null;
  currency?: string | null;
  durationMs?: number;
  requestId?: string | null;
};

export async function recordUsage(r: UsageRecord) {
  if (!isAdminConfigured()) return;
  try {
    const admin = createAdminClient();
    let organizationId: string | null = null;
    if (r.businessId) {
      const { data } = await admin.from("businesses").select("organization_id").eq("id", r.businessId).maybeSingle();
      organizationId = data?.organization_id ?? null;
    }
    const { error } = await admin.from("provider_usage").insert({
      category: r.category,
      provider: r.provider.slice(0, 40),
      model: r.model?.slice(0, 100) ?? null,
      operation: r.operation.slice(0, 60),
      status: r.status,
      organization_id: organizationId,
      business_id: r.businessId ?? null,
      user_id: r.userId ?? null,
      input_tokens: Math.round(r.inputTokens ?? 0),
      cached_input_tokens: Math.round(r.cachedInputTokens ?? 0),
      output_tokens: Math.round(r.outputTokens ?? 0),
      images: Math.round(r.images ?? 0),
      seconds: r.seconds ?? 0,
      amount_cents: r.amountCents ?? null,
      currency: r.currency ?? null,
      duration_ms: r.durationMs != null ? Math.round(r.durationMs) : null,
      request_id: r.requestId?.slice(0, 120) ?? null,
    });
    if (error) throw error;
  } catch (e) {
    await reportError("server", "recordUsage", e, { context: { operation: r.operation, provider: r.provider } });
  }
}
