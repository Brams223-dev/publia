import "server-only";
// Point d'entrée unique de l'IA textuelle. Le code métier n'importe que ce module :
// changer de fournisseur = ajouter une implémentation et la sélectionner via AI_PROVIDER.

import * as openai from "./openai";

export { AIError } from "./openai";

export type StructuredRequest = {
  instructions: string;
  input: string;
  schemaName: string;
  schema: Record<string, unknown>;
  /** Images à analyser (URL HTTPS signées, courte durée). Optionnel. */
  images?: string[];
  timeoutMs?: number;
};

export type AIProvider = {
  id: string;
  isConfigured: () => boolean;
  model: () => string;
  generateStructured: <T>(req: StructuredRequest) => Promise<{ data: T; model: string }>;
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

export async function generateStructured<T>(req: StructuredRequest) {
  const provider = getAIProvider();
  if (!provider || !provider.isConfigured()) throw new openai.AIError("Fournisseur IA non configuré", "config");
  return provider.generateStructured<T>(req);
}
