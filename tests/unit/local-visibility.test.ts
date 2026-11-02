import { test } from "node:test";
import assert from "node:assert/strict";
import { computeVisibility, napBlock, type VisibilityInput } from "@/lib/local-visibility";

const empty: VisibilityInput = {
  business: { name: "Fleurs Léa", category: null, description: null, address: null, city: null, phone: null, website: null, opening_hours: null, logo_url: null, social_links: {} },
  photos: 0, minisitePublished: false, minisiteShowsAddress: true, activeProducts: 0, publishedReviews: 0, recentReviews: 0, repliedReviews: 0, declared: {},
};

test("profil vide : score nul et priorités les plus rentables", () => {
  const r = computeVisibility(empty);
  assert.equal(r.score, 0);
  assert.equal(r.level, "Faible");
  assert.equal(r.priorities[0].id, "gbp_claimed");
  assert.equal(r.priorities.length, 3);
});

test("profil complet : 100 %", () => {
  const full: VisibilityInput = {
    business: { name: "Fleurs Léa", category: "Fleuriste", description: "x".repeat(160), address: "3 rue des Lilas", city: "Paris", phone: "0102030405", website: null, opening_hours: "Mar-Sam 9h-19h", logo_url: "a/logo.png", social_links: { instagram: "@fleurslea" } },
    photos: 4, minisitePublished: true, minisiteShowsAddress: true, activeProducts: 5, publishedReviews: 8, recentReviews: 2, repliedReviews: 6,
    declared: { gbp_claimed: true, gbp_same_info: true, gbp_category: true, gbp_hours: true, gbp_photos: true, gbp_website: true, gbp_posts: true },
  };
  const r = computeVisibility(full);
  assert.equal(r.score, 100);
  assert.equal(r.priorities.length, 0);
  assert.equal(computeVisibility({ ...full, repliedReviews: 3 }).checks.find((c) => c.id === "reviews_replied")!.done, false);
});

test("bloc coordonnées", () => {
  assert.equal(napBlock({ ...empty.business, address: "3 rue des Lilas", city: "Paris", phone: "01 02" }, "https://x.fr/b/lea"), "Fleurs Léa\n3 rue des Lilas, Paris\n01 02\nhttps://x.fr/b/lea");
});
