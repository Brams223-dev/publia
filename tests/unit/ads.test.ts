import { test } from "node:test";
import assert from "node:assert/strict";
import { checkBudget } from "@/lib/ads/budget";
import { sanitize } from "@/lib/ads/generate";

const t = "2026-11-02";

test("contrôle du budget publicitaire", () => {
  const ok = checkBudget({ dailyCents: 500, capCents: 3500, start: t, end: "2026-11-08", today: t });
  assert.ok(ok.ok && ok.days === 7 && ok.plannedCents === 3500);
  assert.equal(checkBudget({ dailyCents: 50, capCents: 50, start: t, end: t, today: t }).ok, false, "moins de 1 €/jour");
  assert.equal(checkBudget({ dailyCents: 500, capCents: 9000, start: t, end: "2026-11-08", today: t }).ok, false, "plafond > budget prévu");
  assert.equal(checkBudget({ dailyCents: 500, capCents: 500, start: "2026-11-01", end: "2026-11-08", today: t }).ok, false, "début passé");
  assert.equal(checkBudget({ dailyCents: 500, capCents: 500, start: t, end: "2027-03-01", today: t }).ok, false, "plus de 90 jours");
});

test("nettoyage des créations et du ciblage", () => {
  const r = sanitize(
    {
      campaign_name: "Menu du midi",
      variants: [{ angle: "Bénéfice", headline: "X".repeat(80), primary_text: "Y".repeat(300), description: "Z".repeat(60), cta: "Cliquez vite !!!" }],
      audience: { radius_km: 300, age_min: 13, age_max: 90, interests: ["Gastronomie", "Santé et bien-être", "Religion", "Sorties", "Gastronomie", "Crédit à la consommation"], rationale: "ok" },
    },
    "meta",
  );
  const v = r.variants[0];
  assert.ok(v.headline.length <= 40 && v.primary_text.length <= 125 && v.description.length <= 30);
  assert.equal(v.cta, "En savoir plus");
  assert.equal(r.audience.age_min, 18);
  assert.equal(r.audience.age_max, 65);
  assert.equal(r.audience.radius_km, 50);
  assert.deepEqual(r.audience.interests, ["Gastronomie", "Sorties"]);

  const g = sanitize(
    { campaign_name: "a", variants: [{ angle: "", headline: "H".repeat(50), primary_text: "P", description: "D".repeat(120), cta: "Appeler" }], audience: { radius_km: 5, age_min: 25, age_max: 55, interests: [], rationale: "" } },
    "google",
  );
  assert.ok(g.variants[0].headline.length <= 30 && g.variants[0].description.length <= 90);
  assert.equal(g.variants[0].cta, "Appeler");
});
