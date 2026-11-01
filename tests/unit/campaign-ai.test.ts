import { test } from "node:test";
import assert from "node:assert/strict";
import type { Business } from "@/lib/business";

// Le client OpenAI lit la clé au chargement du module : on la définit avant l'import dynamique.
process.env.OPENAI_API_KEY = "sk-test";

test("pipeline « Fais ma communication » avec réponse IA simulée (test uniquement)", async () => {
  const bodies: { model: string; input: string; text: { format: { type: string; strict: boolean } } }[] = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (_url: string, init: RequestInit) => {
    bodies.push(JSON.parse(String(init.body)));
    const out = {
      title: "Le burger maison du mois",
      summary: "Faire découvrir le nouveau burger.",
      strategy: "Annonce, coulisses, relance.",
      items: [
        { platform: "instagram", format: "post", day: 1, title: "Nouveau !", caption: "Découvrez notre burger.", short_caption: "Nouveau burger", hashtags: ["burger", "#Lyon", "#burger"], call_to_action: "Passez nous voir", visual_idea: "Photo" },
        { platform: "youtube", format: "short", day: 9, title: "X".repeat(140), caption: "Plan 1", short_caption: "Short", hashtags: ["#burger"], call_to_action: "Abonnez-vous", visual_idea: "Gros plan" },
        { platform: "tiktok", format: "video_courte", day: 3, title: "Hors sujet", caption: "…", short_caption: "", hashtags: [], call_to_action: "", visual_idea: "" },
      ],
    };
    return new Response(JSON.stringify({ model: "gpt-test", output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify(out) }] }] }), { status: 200 });
  }) as typeof fetch;

  try {
    const { generateCampaign } = await import("@/lib/campaigns/generate");
    const business = {
      id: "b", organization_id: "o", name: "Chez Paul", category: "Restaurant", description: "Bistrot", address: null, city: "Lyon", phone: null, website: null,
      tone: "chaleureux", brand_colors: { primary: "#000", secondary: "#000", text: "#000" }, logo_url: null, products: "Burgers", services: null,
      target_audience: null, opening_hours: null, social_links: {}, goals: null, country_code: "FR", locale: "fr", currency: "EUR", timezone: "Europe/Paris",
    } satisfies Business;
    const r = await generateCampaign({ business, objective: "nouveaute", brief: "Nouveau burger maison", facts: null, platforms: ["instagram", "youtube"], durationDays: 7 });

    assert.equal(bodies[0].text.format.type, "json_schema");
    assert.equal(bodies[0].text.format.strict, true);
    assert.ok(bodies[0].input.includes("Aucune offre"), "aucun prix inventable");
    assert.ok(!bodies[0].input.includes("Téléphone"), "pas de coordonnée absente");
    assert.deepEqual(r.campaign.items.map((i) => i.platform), ["instagram", "youtube"], "plateforme non demandée retirée");
    const yt = r.campaign.items.find((i) => i.platform === "youtube")!;
    assert.ok(yt.title.length <= 100);
    assert.equal(yt.day, 7, "jour borné à la durée");
    assert.equal(yt.hashtags[0], "#Shorts");
    assert.deepEqual(r.campaign.items[0].hashtags, ["#burger", "#Lyon"]);
  } finally {
    globalThis.fetch = realFetch;
  }
});
