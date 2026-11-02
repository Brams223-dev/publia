import "server-only";
// Assistant IA de fiche produit : catégorie, fiche, description, attributs, SEO, collections.
// Règle d'or : aucune caractéristique inventée. Chaque attribut porte sa source :
//  - "declared" : écrit par le vendeur (vérifié par le serveur dans son texte) → pré-rempli ;
//  - "observed" : visible sur la photo (aspects visuels uniquement) → pré-rempli, signalé « à confirmer » ;
//  - "suggested" : déduction de l'IA → jamais pré-rempli, proposé au vendeur.

import { generateStructured } from "@/lib/ai";
import type { Business } from "@/lib/business";
import { finalizeProductDraft, PRODUCT_JSON_SCHEMA_BASE, type RawProductDraft } from "./draft";
import { SALE_TYPE_IDS, type Category } from "./config";

const INSTRUCTIONS = `Tu es l'assistant catalogue d'un commerce en France. Tu prépares une fiche produit en français à partir de ce que le vendeur a écrit et, le cas échéant, de ses photos. Le vendeur relira et validera la fiche avant toute mise en vente.

RÈGLES ABSOLUES
- N'invente JAMAIS de caractéristique technique, certification, composition, ingrédient, allergène, garantie, marque, modèle, référence, compatibilité, dimension, poids, origine ni date. Si une information n'est pas fournie, laisse-la de côté et ajoute-la dans "to_verify".
- Pour chaque attribut, indique honnêtement sa source :
  • "declared" : la valeur figure explicitement dans le texte du vendeur ;
  • "observed" : la valeur est réellement visible sur une photo fournie (couleur, style, forme, aspect). Une composition, une taille, une marque ou un état ne s'observent pas avec certitude : utilise alors "suggested" ;
  • "suggested" : ta supposition, à faire confirmer.
- "key" doit être une clé du schéma de la catégorie choisie. Pour un choix fermé, "value" doit être exactement l'une des options ; pour plusieurs choix, sépare-les par des virgules.
- "brand" : uniquement si le vendeur l'a écrite, sinon chaîne vide.
- La description est commerciale mais factuelle : uniquement des éléments fournis, sans superlatif invérifiable, sans allégation de santé, sans promesse.
- Le prix n'est jamais à proposer.
- SEO : un titre de 60 caractères maximum, une méta-description de 155 caractères maximum, 3 à 8 mots-clés que des clients taperaient réellement.
- "collections" : 1 à 3 noms de collections courts et utiles pour ranger ce produit dans la boutique.
- "photo_tips" : 0 à 3 conseils concrets pour de meilleures photos (lumière, fond, angles, détails à montrer), seulement si des photos sont fournies.`;

export async function generateProductDraft({
  business,
  userId,
  categories,
  sellerText,
  categoryId,
  images,
}: {
  userId?: string;
  business: Business;
  categories: Category[];
  sellerText: string;
  categoryId: string | null;
  images: string[];
}) {
  const ids = categories.map((c) => c.id);
  const schema = {
    ...PRODUCT_JSON_SCHEMA_BASE,
    properties: {
      ...PRODUCT_JSON_SCHEMA_BASE.properties,
      category_id: { type: "string", enum: ids },
      sale_type: { type: "string", enum: SALE_TYPE_IDS },
    },
  };

  const catalog = categories
    .map((c) => {
      const attrs = c.attribute_schema
        .map((a) => `${a.key}${a.required ? "*" : ""} (${a.type}${a.options ? ` : ${a.options.join(" | ")}` : ""}${a.unit ? `, en ${a.unit}` : ""})`)
        .join(" ; ");
      return `- ${c.id} : ${c.name} — ventes : ${c.sale_types.join(", ")}${attrs ? ` — attributs : ${attrs}` : ""}`;
    })
    .join("\n");

  const input = [
    "COMMERCE",
    `- Nom : ${business.name}`,
    business.category && `- Secteur : ${business.category}`,
    business.description && `- Description : ${business.description}`,
    "",
    "CATÉGORIES DISPONIBLES (* = obligatoire)",
    catalog,
    "",
    categoryId ? `CATÉGORIE CHOISIE PAR LE VENDEUR : ${categoryId} (conserve-la sauf erreur manifeste)` : "CATÉGORIE : à proposer",
    "",
    "TEXTE DU VENDEUR (seule source d'informations déclarées)",
    sellerText,
    "",
    images.length ? `PHOTOS FOURNIES : ${images.length}` : "AUCUNE PHOTO : aucun attribut ne peut être « observed ».",
  ]
    .filter((l): l is string => typeof l === "string")
    .join("\n");

  const { data, model } = await generateStructured<RawProductDraft>({
    instructions: INSTRUCTIONS,
    input,
    schemaName: "publia_fiche_produit",
    schema: schema as unknown as Record<string, unknown>,
    images,
    meter: { operation: "generate_product", businessId: business.id, userId },
  });

  return { ...finalizeProductDraft(data, { categories, sellerText, chosenCategoryId: categoryId, hasImages: images.length > 0 }), model };
}
