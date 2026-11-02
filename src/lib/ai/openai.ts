import "server-only";

// Client OpenAI minimal (API Responses + sorties structurées JSON Schema).
// Le modèle est configurable : OPENAI_MODEL dans Vercel, sans redéployer le code.

const API_KEY = (process.env.OPENAI_API_KEY ?? "").trim();
export const OPENAI_MODEL = (process.env.OPENAI_MODEL ?? "gpt-6.1-terra").trim();

export const isAIConfigured = () => Boolean(API_KEY);

export type AIUsage = { inputTokens: number; cachedInputTokens: number; outputTokens: number };

export class AIError extends Error {
  constructor(
    message: string,
    public readonly kind: "config" | "timeout" | "refusal" | "rate_limit" | "upstream" | "invalid",
    /** Unités facturées malgré l'échec (réponse reçue mais inexploitable). */
    public readonly usage?: AIUsage,
    public readonly model?: string,
  ) {
    super(message);
  }
}

type RawUsage = { input_tokens?: number; output_tokens?: number; input_tokens_details?: { cached_tokens?: number } };
const toUsage = (u: RawUsage | undefined): AIUsage => ({
  inputTokens: Math.max(0, Number(u?.input_tokens ?? 0)),
  cachedInputTokens: Math.max(0, Number(u?.input_tokens_details?.cached_tokens ?? 0)),
  outputTokens: Math.max(0, Number(u?.output_tokens ?? 0)),
});

type OutputItem = { type: string; content?: { type: string; text?: string; refusal?: string }[] };

export async function generateStructured<T>({
  instructions,
  input,
  schemaName,
  schema,
  images = [],
  timeoutMs = 90_000,
}: {
  instructions: string;
  input: string;
  schemaName: string;
  schema: Record<string, unknown>;
  images?: string[];
  timeoutMs?: number;
}): Promise<{ data: T; model: string; usage: AIUsage; requestId: string | null }> {
  if (!isAIConfigured()) throw new AIError("OPENAI_API_KEY manquante", "config");

  let res: Response;
  try {
    res = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${API_KEY}` },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        instructions,
        input: images.length
          ? [
              {
                role: "user",
                content: [
                  { type: "input_text", text: input },
                  ...images.slice(0, 4).map((url) => ({ type: "input_image", image_url: url, detail: "low" })),
                ],
              },
            ]
          : input,
        text: { format: { type: "json_schema", name: schemaName, schema, strict: true } },
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (e) {
    if (e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError"))
      throw new AIError("Délai dépassé", "timeout");
    throw new AIError("OpenAI injoignable", "upstream");
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error("[openai]", res.status, body.slice(0, 500));
    if (res.status === 429) throw new AIError("Limite OpenAI atteinte", "rate_limit");
    if (res.status === 401 || res.status === 403) throw new AIError("Clé OpenAI refusée", "config");
    if (res.status === 404 || res.status === 400) throw new AIError(`Requête refusée (${res.status})`, "config");
    throw new AIError(`Erreur OpenAI ${res.status}`, "upstream");
  }

  const json = (await res.json()) as { id?: string; model?: string; output?: OutputItem[]; status?: string; usage?: RawUsage };
  const usage = toUsage(json.usage);
  const model = json.model ?? OPENAI_MODEL;
  const parts = (json.output ?? []).filter((o) => o.type === "message").flatMap((o) => o.content ?? []);
  if (parts.some((p) => p.type === "refusal")) throw new AIError("Demande refusée par le modèle", "refusal", usage, model);
  const text = parts
    .filter((p) => p.type === "output_text")
    .map((p) => p.text ?? "")
    .join("");
  if (!text) throw new AIError("Réponse vide", "invalid", usage, model);

  try {
    return { data: JSON.parse(text) as T, model, usage, requestId: json.id ?? null };
  } catch {
    throw new AIError("Réponse illisible", "invalid", usage, model);
  }
}
