import { test as t } from "node:test";
import assert from "node:assert/strict";
import { validateAttributes, missingRequired } from "@/lib/commerce/attributes";
import { checkCompliance } from "@/config/commerce-rules";
import type { AttributeDef } from "@/lib/commerce/config";

const elec: AttributeDef[] = [
  { key: "modele", label: "Modèle", type: "text" },
  { key: "connectivite", label: "Connectivité", type: "multiselect", options: ["Wi-Fi", "5G"] },
  { key: "etat", label: "État", type: "select", options: ["Neuf", "Occasion"], required: true },
  { key: "garantie_mois", label: "Garantie", type: "number", unit: "mois" },
  { key: "montage", label: "Montage", type: "boolean" },
  { key: "sortie", label: "Sortie", type: "date" },
];

t("valeurs typées", () => {
  const r = validateAttributes(elec, { modele: " X12 ", connectivite: "Wi-Fi,5G,Wi-Fi", etat: "Neuf", garantie_mois: "24,5", montage: "on", sortie: "2026-03-01" });
  assert.deepEqual(r.errors, []);
  assert.deepEqual(r.values, { modele: "X12", connectivite: ["Wi-Fi", "5G"], etat: "Neuf", garantie_mois: 24.5, montage: true, sortie: "2026-03-01" });
});
t("obligatoire manquant", () => assert.equal(validateAttributes(elec, {}).errors.length, 1));
t("brouillon tolère obligatoire", () => assert.equal(validateAttributes(elec, {}, { allowMissingRequired: true }).errors.length, 0));
t("option inconnue refusée", () => assert.match(validateAttributes(elec, { etat: "Cassé" }).errors[0], /choix/));
t("multiselect inconnu", () => assert.match(validateAttributes(elec, { etat: "Neuf", connectivite: ["6G"] }).errors[0], /6G/));
t("nombre invalide", () => assert.match(validateAttributes(elec, { etat: "Neuf", garantie_mois: "deux" }).errors[0], /nombre/));
t("nombre négatif", () => assert.equal(validateAttributes(elec, { etat: "Neuf", garantie_mois: -1 }).errors.length, 1));
t("date invalide", () => assert.equal(validateAttributes(elec, { etat: "Neuf", sortie: "01/03/2026" }).errors.length, 1));
t("clé inconnue ignorée", () => assert.deepEqual(validateAttributes(elec, { etat: "Neuf", hack: "x" }).values, { etat: "Neuf" }));
t("attribut personnalisé", () => assert.deepEqual(validateAttributes([], { "custom:doublure": "Soie" }).values, { "custom:doublure": "Soie" }));
t("clé personnalisée invalide", () => assert.equal(validateAttributes([], { "custom:Bad Key!": "x" }).errors.length, 1));
t("missingRequired", () => assert.deepEqual(missingRequired(elec, { etat: "" }), ["État"]));

const c = (text: string, categoryId = "mode", regulated = false, attributes = {}) => checkCompliance({ country: "FR", categoryId, regulated, text, attributes });
t("produit ordinaire ok", () => assert.equal(c("Robe en lin bleue, coupe droite").level, "ok"));
t("tabac bloqué", () => assert.equal(c("Paquet de cigarettes blondes").level, "blocked"));
t("puff bloquée", () => assert.equal(c("Puff 600 bouffées goût fraise").level, "blocked"));
t("médicament bloqué", () => assert.equal(c("Paracétamol 500 mg").level, "blocked"));
t("contrefaçon bloquée", () => assert.equal(c("Sac réplique rep 1:1").level, "blocked"));
t("pas de faux positif accent/mot", () => {
  assert.equal(c("Pistolet à colle chaude pour bricolage", "bricolage").level, "ok");
  assert.equal(c("Ventilateur silencieux", "electromenager").level, "ok");
  assert.equal(c("Travail soigné, cuir pleine fleur").level, "ok");
  assert.equal(c("Cigarettier en argent vintage").level, "ok");
});
t("CBD à vérifier", () => assert.equal(c("Huile CBD 10%", "soin", true).level, "to_verify"));
t("cosmétique : checklist", () => { const r = c("Crème hydratante", "beaute", true); assert.equal(r.level, "to_verify"); assert.equal(r.checklist.length, 3); });
t("alcool : checklist supplémentaire", () => {
  const r = c("Vin rouge bio", "boissons", true, { alcool: true });
  assert.equal(r.level, "to_verify"); assert.ok(r.checklist.some((x) => /mineurs/.test(x)));
  assert.ok(!c("Jus de pomme", "boissons", true, { alcool: false }).checklist.some((x) => /mineurs/.test(x)));
});
t("bloqué l'emporte", () => assert.equal(c("Cigares et crème", "beaute", true).level, "blocked"));
