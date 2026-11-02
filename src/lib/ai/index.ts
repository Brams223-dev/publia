import "server-only";
// Point d'entrée unique de l'IA textuelle. Le code métier n'importe que ce module :
// changer de fournisseur = ajouter une implémentation et la sélectionner via AI_PROVIDER.
// Chaque appel est mesuré (jetons réellement facturés) dans provider_usage.

import * as openai from "./openai";
import { recordUsage, type Meter } from "@/lib/usage";

export { AIError } from "./openai";
export type { AIUsage } from "./openai";
export type { Meter } from "@/lib/usage";

export type StructuredRequest = {
  instructions: string;
  input: string;
  schemaName: string;
  schema: Record<string, unknown>;
  /** Images à analyser (URL HTTPS signées, courte durée). Optionnel. */
  images?: string[];
  timeoutMs?: number;
};

export type StructuredResult<T> = { data: T; model: string; usage: openai.AIUsage; requestId: string | null };

export type AIProvider = {
  id: string;
  isConfigured: () => boolean;
  model: () => string;
  generateStructured: <T>(req: StructuredRequest) => Promise<StructuredResult<T>>;
};

const PROVIDERS: Record<string, AIProvider> = {
  openai: {
    id: "openai",
    isConfigured: openai.isAIConfigured,
    model: () => openai.OPENAI_MODEL,
    generateStructured: openai.generateStructured,
  },
};

/** Fournisseur actif (OpenAI par défaut). Un identifiant inconnu n'est jamais remplacé silencieusement. */
export function getAIProvider(): AIProvider | null {
  const id = (process.env.AI_PROVIDER ?? "openai").trim().toLowerCase();
  return PROVIDERS[id] ?? null;
}

export const isAIConfigured = () => Boolean(getAIProvider()?.isConfigured());

/**
 * Génération structurée. `meter` (opération, commerce, utilisateur) permet d'imputer le coût réel
 * à la bonne organisation ; l'enregistrement est fait aussi en cas d'échec facturé.
 */
export async function generateStructured<T>(req: StructuredRequest & { meter?: Meter }) {
  const provider = getAIProvider();
  if (!provider || !provider.isConfigured()) throw new openai.AIError("Fournisseur IA non configuré", "config");
  const { meter, ...request } = req;
  const started = Date.now();
  try {
    const res = await provider.generateStructured<T>(request);
    if (meter) await recordUsage({ ...meter, category: "ai", provider: provider.id, model: res.model, status: "ok", ...res.usage, images: request.images?.length ?? 0, durationMs: Date.now() - started, requestId: res.requestId });
    return res;
  } catch (e) {
    if (meter && e instanceof openai.AIError && e.usage) {
      await recordUsage({ ...meter, category: "ai", provider: provider.id, model: e.model ?? provider.model(), status: "error", ...e.usage, images: request.images?.length ?? 0, durationMs: Date.now() - started });
    }
    throw e;
  }
}
