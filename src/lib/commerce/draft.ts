// Post-traitement serveur de la fiche produit proposée par l'IA (pur, testable).
// Le serveur ne fait jamais confiance à la source annoncée par le modèle : une valeur
// « déclarée » absente du texte du vendeur est rétrogradée en suggestion, et les
// informations sensibles (garantie, composition, compatibilité…) ne sont jamais pré-remplies
// sans déclaration.

import { z } from "zod";
import { missingRequired, slugKey, validateAttributes, type AttributeValue } from "./attributes";
import { SALE_TYPE_IDS, type AttributeDef, type Category, type SaleType } from "./config";

export const PRODUCT_JSON_SCHEMA_BASE = {
  type: "object",
  additionalProperties: false,
  required: ["category_id", "category_confidence", "sale_type", "name", "description", "brand", "attributes", "to_verify", "seo", "collections", "photo_tips"],
  properties: {
    category_id: { type: "string" },
    category_confidence: { type: "string", enum: ["high", "medium", "low"] },
    sale_type: { type: "string" },
    name: { type: "string", description: "Nom clair du produit, 80 caractères maximum" },
    description: { type: "string", description: "Description commerciale factuelle, 2 à 5 phrases" },
    brand: { type: "string" },
    attributes: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["key", "value", "source"],
        properties: {
          key: { type: "string" },
          value: { type: "string" },
          source: { type: "string", enum: ["declared", "observed", "suggested"] },
        },
      },
    },
    to_verify: { type: "array", items: { type: "string" }, description: "Informations manquantes ou incertaines à faire confirmer" },
    seo: {
      type: "object",
      additionalProperties: false,
      required: ["title", "meta_description", "keywords"],
      properties: {
        title: { type: "string" },
        meta_description: { type: "string" },
        keywords: { type: "array", items: { type: "string" } },
      },
    },
    collections: { type: "array", items: { type: "string" } },
    photo_tips: { type: "array", items: { type: "string" } },
  },
} as const;

const rawSchema = z.object({
  category_id: z.string(),
  category_confidence: z.enum(["high", "medium", "low"]),
  sale_type: z.string(),
  name: z.string().trim().min(1),
  description: z.string().trim(),
  brand: z.string().trim(),
  attributes: z.array(z.object({ key: z.string().trim(), value: z.string().trim(), source: z.enum(["declared", "observed", "suggested"]) })),
  to_verify: z.array(z.string()),
  seo: z.object({ title: z.string().trim(), meta_description: z.string().trim(), keywords: z.array(z.string()) }),
  collections: z.array(z.string()),
  photo_tips: z.array(z.string()),
});
export type RawProductDraft = z.infer<typeof rawSchema>;

/** Attributs qui ne doivent jamais être pré-remplis sans déclaration explicite du vendeur. */
const DECLARATION_ONLY = new Set([
  "garantie_mois", "ingredients", "allergenes", "ref_fabricant", "modele_compatible", "marque_vehicule", "annee", "motorisation",
  "isbn", "licence", "classe_energie", "degre", "alcool", "age_min", "avertissements", "precautions", "pao_mois", "etat",
  "capacite", "memoire", "processeur", "stockage", "puissance_w", "dlc", "origine", "poids_net", "contenance", "taille",
  "pointure", "matiere", "materiaux", "modele", "version", "taille_fichier", "auteur", "editeur", "conservation",
]);
/** Aspects réellement observables sur une photo. */
const OBSERVABLE = new Set(["couleur", "couleurs", "style", "coupe", "genre", "technique", "varietes"]);

function norm(s: string) {
  return ` ${s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9.,]+/g, " ").replace(/(\d),(\d)/g, "$1.$2").trim()} `;
}

/** Vrai si la valeur figure dans le texte du vendeur (chaque élément significatif présent). */
export function isGrounded(value: string, sellerText: string) {
  const hay = norm(sellerText);
  const tokens = norm(value).split(/[\s,]+/).filter((t) => t.length >= 2 || /\d/.test(t));
  if (!tokens.length) return false;
  return tokens.every((t) => hay.includes(` ${t} `) || hay.includes(` ${t}`) || (/\d/.test(t) && hay.includes(t)));
}

const clip = (s: string, max: number) => (s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s);

export type Suggestion = { key: string; label: string; value: string; source: "observed" | "suggested" };

export function finalizeProductDraft(
  raw: unknown,
  { categories, sellerText, chosenCategoryId, hasImages }: { categories: Category[]; sellerText: string; chosenCategoryId: string | null; hasImages: boolean },
) {
  const r = rawSchema.parse(raw);
  const toVerify = new Set(r.to_verify.map((s) => clip(s.trim(), 200)).filter(Boolean));

  let category = categories.find((c) => c.id === r.category_id) ?? categories.find((c) => c.id === "autre") ?? categories[0];
  if (chosenCategoryId) {
    const chosen = categories.find((c) => c.id === chosenCategoryId);
    if (chosen && chosen.id !== category.id) toVerify.add(`L'assistant aurait plutôt classé ce produit dans « ${category.name} ». Vérifiez la catégorie.`);
    if (chosen) category = chosen;
  } else if (r.category_confidence !== "high") {
    toVerify.add(`Catégorie proposée : « ${category.name} ». Confirmez-la.`);
  }

  const saleType: SaleType = (SALE_TYPE_IDS as string[]).includes(r.sale_type) && category.sale_types.includes(r.sale_type as SaleType)
    ? (r.sale_type as SaleType)
    : category.sale_types[0] ?? "physical";

  const defs = new Map<string, AttributeDef>(category.attribute_schema.map((d) => [d.key, d]));
  const filled: Record<string, unknown> = {};
  const declared: string[] = [];
  const observed: string[] = [];
  const suggestions: Suggestion[] = [];

  for (const a of r.attributes) {
    if (!a.value) continue;
    const def = defs.get(a.key);
    const grounded = isGrounded(a.value, sellerText);
    if (!def) {
      // Caractéristique hors schéma : conservée seulement si le vendeur l'a écrite.
      const k = slugKey(a.key);
      if (k && a.source === "declared" && grounded) {
        filled[`custom:${k}`] = a.value;
        declared.push(`custom:${k}`);
      }
      continue;
    }
    if (a.source === "declared" && grounded) {
      filled[def.key] = def.type === "multiselect" ? a.value.split(",").map((x) => x.trim()) : a.value;
      declared.push(def.key);
    } else if (a.source === "observed" && hasImages && OBSERVABLE.has(def.key) && !DECLARATION_ONLY.has(def.key)) {
      filled[def.key] = def.type === "multiselect" ? a.value.split(",").map((x) => x.trim()) : a.value;
      observed.push(def.key);
    } else {
      suggestions.push({ key: def.key, label: def.label, value: clip(a.value, 200), source: a.source === "observed" && hasImages ? "observed" : "suggested" });
    }
  }

  // Validation typée : une valeur hors schéma n'est jamais enregistrée.
  const checked = validateAttributes(category.attribute_schema, filled, { allowMissingRequired: true });
  for (const e of checked.errors) toVerify.add(e);
  const attributes: Record<string, AttributeValue> = checked.values;
  const keep = (k: string) => k in attributes;

  const brand = r.brand && isGrounded(r.brand, sellerText) ? clip(r.brand, 120) : "";
  if (r.brand && !brand) toVerify.add(`Marque possible : « ${clip(r.brand, 60)} ». Indiquez-la vous-même si elle est exacte.`);

  const missing = missingRequired(category.attribute_schema, attributes);
  for (const m of missing) toVerify.add(`${m} : information obligatoire à compléter.`);

  const keywords = Array.from(new Set(r.seo.keywords.map((k) => k.trim().toLowerCase()).filter(Boolean))).slice(0, 8);

  return {
    draft: {
      category_id: category.id,
      sale_type: saleType,
      name: clip(r.name, 200),
      description: clip(r.description, 5000),
      brand,
      attributes,
      seo: { title: clip(r.seo.title, 70), meta_description: clip(r.seo.meta_description, 160), keywords },
    },
    meta: {
      declared: declared.filter(keep),
      observed: observed.filter(keep),
      suggestions: suggestions.slice(0, 20),
      to_verify: Array.from(toVerify).slice(0, 20),
      missing,
      collections: Array.from(new Set(r.collections.map((c) => clip(c.trim(), 60)).filter(Boolean))).slice(0, 3),
      photo_tips: hasImages ? r.photo_tips.map((t) => clip(t.trim(), 200)).filter(Boolean).slice(0, 3) : [],
      category_confidence: r.category_confidence,
    },
  };
}

export type ProductDraft = ReturnType<typeof finalizeProductDraft>;
