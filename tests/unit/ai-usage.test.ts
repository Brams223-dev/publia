import { test } from "node:test";
import assert from "node:assert/strict";

process.env.OPENAI_API_KEY = "sk-test";

test("les jetons réellement facturés sont remontés, y compris en cas de réponse inexploitable", async () => {
  const { generateStructured, AIError } = await import("@/lib/ai/openai");
  const realFetch = globalThis.fetch;
  const reply = (text: string) =>
    new Response(JSON.stringify({
      id: "resp_123", model: "modele-test",
      usage: { input_tokens: 1200, output_tokens: 340, input_tokens_details: { cached_tokens: 200 } },
      output: [{ type: "message", content: [{ type: "output_text", text }] }],
    }), { status: 200 });
  try {
    globalThis.fetch = (async () => reply('{"ok":true}')) as typeof fetch;
    const r = await generateStructured<{ ok: boolean }>({ instructions: "i", input: "x", schemaName: "s", schema: {} });
    assert.deepEqual(r.usage, { inputTokens: 1200, cachedInputTokens: 200, outputTokens: 340 });
    assert.equal(r.requestId, "resp_123");
    assert.equal(r.model, "modele-test");

    globalThis.fetch = (async () => reply("pas du json")) as typeof fetch;
    await assert.rejects(
      generateStructured({ instructions: "i", input: "x", schemaName: "s", schema: {} }),
      (e: unknown) => e instanceof AIError && e.kind === "invalid" && e.usage?.outputTokens === 340,
    );
  } finally {
    globalThis.fetch = realFetch;
  }
});
