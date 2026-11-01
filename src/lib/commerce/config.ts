// Publia Commerce — référentiels partagés (client + serveur).
// Les catégories et leurs attributs vivent en base (product_categories) : ce fichier ne
// contient que les listes fermées validées par les contraintes SQL.

export type AttributeType = "text" | "textarea" | "number" | "select" | "multiselect" | "boolean" | "date";

export type AttributeDef = {
  key: string;
  label: string;
  type: AttributeType;
  unit?: string;
  options?: string[];
  required?: boolean;
  filterable?: boolean;
};

export type Category = {
  id: string;
  name: string;
  attribute_schema: AttributeDef[];
  sale_types: SaleType[];
  regulated: boolean;
  sort_order: number;
};

export const SALE_TYPES = {
  physical: { label: "Produit physique", hint: "Expédié ou retiré en boutique" },
  digital: { label: "Produit numérique", hint: "Fichier ou accès livré en ligne" },
  custom: { label: "Produit personnalisé", hint: "Adapté à la demande du client" },
  made_to_order: { label: "Fabriqué sur commande", hint: "Produit après la commande" },
  bundle: { label: "Lot ou pack", hint: "Plusieurs articles vendus ensemble" },
  service: { label: "Service / prestation", hint: "Réalisé par vous" },
  booking: { label: "Réservation", hint: "Créneau à réserver" },
} as const;
export type SaleType = keyof typeof SALE_TYPES;
export const SALE_TYPE_IDS = Object.keys(SALE_TYPES) as SaleType[];

export const STOCK_POLICIES = {
  tracked: "Stock suivi",
  untracked: "Stock non suivi",
  preorder: "Précommande",
  on_order: "Disponible sur commande",
} as const;
export type StockPolicy = keyof typeof STOCK_POLICIES;
export const STOCK_POLICY_IDS = Object.keys(STOCK_POLICIES) as StockPolicy[];

export const UNITS = {
  unit: "à l'unité",
  kg: "au kilo",
  g: "au gramme",
  l: "au litre",
  ml: "au millilitre",
  m: "au mètre",
  cm: "au centimètre",
  m2: "au m²",
  hour: "à l'heure",
  session: "à la séance",
} as const;
export type Unit = keyof typeof UNITS;
export const UNIT_IDS = Object.keys(UNITS) as Unit[];

export const PRODUCT_STATUS = {
  draft: { label: "Brouillon", tone: "bg-neutral-100 text-neutral-700" },
  review: { label: "À vérifier", tone: "bg-amber-50 text-amber-800" },
  active: { label: "Actif", tone: "bg-success/10 text-success" },
  archived: { label: "Archivé", tone: "bg-neutral-100 text-neutral-500" },
} as const;
export type ProductStatus = keyof typeof PRODUCT_STATUS;

export const COMPLIANCE_STATUS = {
  ok: "Conforme",
  to_verify: "Vérification requise",
  blocked: "Vente non autorisée",
} as const;
export type ComplianceStatus = keyof typeof COMPLIANCE_STATUS;

export const SORTS = {
  recent: "Plus récents",
  name: "Nom (A → Z)",
  price_asc: "Prix croissant",
  price_desc: "Prix décroissant",
  stock: "Stock le plus bas",
} as const;
export type SortId = keyof typeof SORTS;

export const LIMITS = {
  variantsMax: 100,
  mediaMax: 12,
  collectionsMax: 100,
  pageSize: 30,
  mediaMaxBytes: 15 * 1024 * 1024,
  mediaTypes: ["image/png", "image/jpeg", "image/webp"],
} as const;

// ---------------------------------------------------------------------------
// Modèles de boutique par métier : catégories mises en avant, filtres proposés
// et fonctionnalités pertinentes. Le design de la boutique publique s'appuiera
// sur ces modèles quand la vitrine en ligne sera livrée.
// ---------------------------------------------------------------------------
export type ShopTemplate = {
  id: string;
  name: string;
  description: string;
  categories: string[];
  filters: string[];
  features: string[];
  accent: string;
};

export const SHOP_TEMPLATES: ShopTemplate[] = [
  { id: "vetements", name: "Boutique de vêtements", description: "Tailles, couleurs, nouveautés et lookbooks.", categories: ["mode", "chaussures", "maroquinerie", "bijoux"], filters: ["taille", "couleur", "genre", "matiere"], features: ["Variantes taille × couleur", "Guide des tailles", "Collections saisonnières"], accent: "#6B55D9" },
  { id: "chaussures", name: "Boutique de chaussures", description: "Pointures, matières et collections.", categories: ["chaussures", "maroquinerie"], filters: ["pointure", "couleur", "genre"], features: ["Variantes par pointure", "Stock par pointure"], accent: "#3F3D8F" },
  { id: "electronique", name: "Magasin d'électronique", description: "Fiches techniques, état et garanties.", categories: ["electronique", "informatique", "electromenager"], filters: ["modele", "capacite", "etat"], features: ["Fiche technique détaillée", "État neuf / reconditionné", "Garantie affichée"], accent: "#1E6FD9" },
  { id: "meubles", name: "Boutique de meubles", description: "Dimensions, matériaux et fabrication sur commande.", categories: ["meubles", "maison"], filters: ["materiaux", "couleurs"], features: ["Dimensions détaillées", "Fabrication sur commande", "Livraison volumineuse"], accent: "#8A5A2B" },
  { id: "epicerie", name: "Épicerie", description: "Ingrédients, allergènes et vente au poids.", categories: ["alimentation", "boissons"], filters: ["allergenes", "origine"], features: ["Vente au poids", "Allergènes obligatoires", "Retrait en boutique"], accent: "#2F855A" },
  { id: "fleuriste", name: "Fleuriste", description: "Bouquets, compositions et créations sur mesure.", categories: ["fleurs", "jardinage"], filters: ["taille"], features: ["Créations personnalisées", "Message carte", "Retrait ou livraison locale"], accent: "#C2417A" },
  { id: "pieces-auto", name: "Magasin de pièces automobiles", description: "Références et compatibilités véhicule.", categories: ["auto", "bricolage"], filters: ["marque_vehicule", "modele_compatible", "ref_fabricant"], features: ["Recherche par compatibilité", "Référence fabricant obligatoire"], accent: "#2D3748" },
  { id: "beaute", name: "Boutique de beauté", description: "Compositions, contenances et conseils.", categories: ["beaute", "soin"], filters: ["type_peau"], features: ["Composition INCI", "Durée après ouverture"], accent: "#B83280" },
  { id: "sport", name: "Magasin de sport", description: "Équipement par sport et par niveau.", categories: ["sport", "mode", "chaussures"], filters: ["sport", "niveau", "taille"], features: ["Filtres par sport", "Variantes de taille"], accent: "#DD6B20" },
  { id: "artisan", name: "Artisan", description: "Savoir-faire, pièces uniques et commandes.", categories: ["artisanat", "fait-main", "services"], filters: ["matiere"], features: ["Pièces uniques", "Fabrication sur commande", "Prestations"], accent: "#975A16" },
  { id: "createur", name: "Créateur", description: "Collections, éditions limitées et précommandes.", categories: ["fait-main", "mode", "bijoux", "numerique"], filters: ["matiere"], features: ["Précommandes", "Éditions limitées", "Produits numériques"], accent: "#805AD5" },
  { id: "librairie", name: "Librairie", description: "Auteurs, éditeurs et langues.", categories: ["livres", "numerique", "formations"], filters: ["auteur", "langue"], features: ["ISBN", "Livres d'occasion", "Contenus numériques"], accent: "#2C5282" },
  { id: "generaliste", name: "Commerce généraliste", description: "Toutes les catégories, sans spécialisation.", categories: [], filters: [], features: ["Toutes catégories", "Filtres selon la catégorie"], accent: "#6B55D9" },
];

export const templateById = (id: string | null | undefined) =>
  SHOP_TEMPLATES.find((t) => t.id === id) ?? SHOP_TEMPLATES[SHOP_TEMPLATES.length - 1];
