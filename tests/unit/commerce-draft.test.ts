import { test as t } from "node:test";
import assert from "node:assert/strict";
import { finalizeProductDraft, isGrounded } from "@/lib/commerce/draft";
import type { Category } from "@/lib/commerce/config";
const cats: Category[] = [
  { id: "electronique", name: "Téléphones et électronique", sale_types: ["physical"], regulated: false, sort_order: 5, attribute_schema: [
    { key: "modele", label: "Modèle", type: "text" }, { key: "capacite", label: "Capacité", type: "text" },
    { key: "couleur", label: "Couleur", type: "text" },
    { key: "etat", label: "État", type: "select", options: ["Neuf", "Reconditionné", "Occasion"], required: true },
    { key: "garantie_mois", label: "Garantie", type: "number", unit: "mois" },
    { key: "connectivite", label: "Connectivité", type: "multiselect", options: ["Wi-Fi", "5G", "NFC"] } ] },
  { id: "mode", name: "Mode", sale_types: ["physical", "custom"], regulated: false, sort_order: 1, attribute_schema: [{ key: "couleur", label: "Couleur", type: "text" }] },
  { id: "autre", name: "Autres", sale_types: ["physical"], regulated: false, sort_order: 99, attribute_schema: [] },
];
const seller = "iPhone 13 128 Go reconditionné, très bon état, compatible 5G et NFC. Livré avec câble.";
const base = { category_id: "electronique", category_confidence: "high", sale_type: "physical", name: "iPhone 13 128 Go", description: "Smartphone reconditionné.", brand: "Apple",
  to_verify: [], seo: { title: "iPhone 13 128 Go reconditionné", meta_description: "x", keywords: ["iphone 13", "Iphone 13", "reconditionné"] }, collections: ["Smartphones"], photo_tips: ["Fond blanc"] };

t("grounding", () => { assert.ok(isGrounded("128 Go", seller)); assert.ok(isGrounded("Reconditionné", seller)); assert.ok(!isGrounded("24", seller)); assert.ok(!isGrounded("Apple", seller)); });
const out = finalizeProductDraft({ ...base, attributes: [
  { key: "capacite", value: "128 Go", source: "declared" },
  { key: "etat", value: "Reconditionné", source: "declared" },
  { key: "connectivite", value: "5G, NFC", source: "declared" },
  { key: "garantie_mois", value: "24", source: "declared" },          // inventé → suggestion
  { key: "modele", value: "iPhone 13", source: "observed" },          // non observable → suggestion
  { key: "couleur", value: "Bleu", source: "observed" },              // observable → pré-rempli (photos)
  { key: "accessoires", value: "câble", source: "declared" },         // hors schéma, déclaré
  { key: "hack", value: "x", source: "suggested" },
] }, { categories: cats, sellerText: seller, chosenCategoryId: null, hasImages: true });
t("déclarés pré-remplis", () => assert.deepEqual(out.draft.attributes, { capacite: "128 Go", etat: "Reconditionné", connectivite: ["5G", "NFC"], couleur: "Bleu", "custom:accessoires": "câble" }));
t("sources", () => { assert.deepEqual(out.meta.declared, ["capacite", "etat", "connectivite", "custom:accessoires"]); assert.deepEqual(out.meta.observed, ["couleur"]); });
t("inventions → suggestions", () => assert.deepEqual(out.meta.suggestions.map((s) => s.key), ["garantie_mois", "modele"]));
t("marque non déclarée retirée", () => { assert.equal(out.draft.brand, ""); assert.ok(out.meta.to_verify.some((x) => /Apple/.test(x))); });
t("mots-clés dédoublonnés", () => assert.deepEqual(out.draft.seo.keywords, ["iphone 13", "reconditionné"]));
const noimg = finalizeProductDraft({ ...base, attributes: [{ key: "couleur", value: "Bleu", source: "observed" }] }, { categories: cats, sellerText: seller, chosenCategoryId: null, hasImages: false });
t("pas de photo → pas d'observé", () => { assert.deepEqual(noimg.draft.attributes, {}); assert.equal(noimg.meta.photo_tips.length, 0); });
t("obligatoire manquant signalé", () => { assert.deepEqual(noimg.meta.missing, ["État"]); assert.ok(noimg.meta.to_verify.some((x) => /État/.test(x))); });
const badopt = finalizeProductDraft({ ...base, attributes: [{ key: "etat", value: "très bon état", source: "declared" }] }, { categories: cats, sellerText: seller, chosenCategoryId: null, hasImages: false });
t("option invalide rejetée", () => { assert.equal(badopt.draft.attributes.etat, undefined); assert.ok(badopt.meta.to_verify.length > 0); });
const chosen = finalizeProductDraft({ ...base, attributes: [] }, { categories: cats, sellerText: seller, chosenCategoryId: "mode", hasImages: false });
t("catégorie du vendeur conservée + alerte", () => { assert.equal(chosen.draft.category_id, "mode"); assert.ok(chosen.meta.to_verify.some((x) => /classé/.test(x))); });
const unk = finalizeProductDraft({ ...base, category_id: "nimporte", sale_type: "digital", attributes: [] }, { categories: cats, sellerText: seller, chosenCategoryId: null, hasImages: false });
t("catégorie inconnue → autre ; type de vente incompatible corrigé", () => { assert.equal(unk.draft.category_id, "autre"); assert.equal(unk.draft.sale_type, "physical"); });
