import { test } from "node:test";
import assert from "node:assert/strict";
import { averageRating, readSettings, slugify, validateSlug } from "@/lib/minisite";

test("adresse du mini-site", () => {
  assert.equal(slugify("Fleurs & Cie — Paris 11e"), "fleurs-et-cie-paris-11e");
  assert.equal(slugify("Épicerie   d'Émile"), "epicerie-d-emile");
  assert.equal(validateSlug("ab"), "L'adresse doit contenir 3 à 60 caractères : lettres minuscules, chiffres et tirets.");
  assert.match(String(validateSlug("admin")), /réservée/);
  assert.match(String(validateSlug("a--b")), /tiret/);
  assert.equal(validateSlug("boulangerie-martin"), null);
});

test("réglages : valeurs par défaut et lien Google contrôlé", () => {
  const d = readSettings(null);
  assert.equal(d.show_catalogue, true);
  assert.equal(d.google_review_url, "");
  const bad = readSettings({ google_review_url: "https://evil.example/review", show_catalogue: false, headline: "Bonjour" });
  assert.deepEqual([bad.google_review_url, bad.show_catalogue, bad.headline], ["", false, "Bonjour"], "lien non Google ignoré, le reste conservé");
  assert.equal(readSettings({ google_review_url: "https://g.page/r/abc/review" }).google_review_url, "https://g.page/r/abc/review");
});

test("moyenne des avis", () => {
  assert.equal(averageRating([]), null);
  assert.equal(averageRating([5, 4, 4]), 4.3);
});
