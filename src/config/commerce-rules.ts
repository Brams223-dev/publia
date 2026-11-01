// Règles de conformité Publia Commerce, configurables par pays.
//
// Principe : Publia ne laisse jamais mettre en vente un produit interdit ou restreint
// par la loi applicable ou par les conditions des prestataires de paiement.
// - "blocked"   : la mise en vente est refusée (le produit reste en brouillon).
// - "to_verify" : la mise en vente exige que le commerçant confirme une liste de vérifications.
//
// Ces règles sont un filet de sécurité, pas un avis juridique : elles reposent sur des mots-clés
// et sur les catégories réglementées. Avant d'activer un nouveau pays, faire valider sa liste
// (voir aussi la checklist de src/config/markets.ts).

export type ComplianceLevel = "ok" | "to_verify" | "blocked";

type KeywordRule = { id: string; level: Exclude<ComplianceLevel, "ok">; terms: string[]; reason: string };
type CategoryRule = { checklist: string[] };

export type CountryCommerceRules = {
  keywords: KeywordRule[];
  /** Vérifications à confirmer pour les catégories réglementées (product_categories.regulated). */
  categories: Record<string, CategoryRule>;
  /** Vérifications supplémentaires déclenchées par la valeur d'un attribut. */
  attributeChecks: { category: string; key: string; equals: unknown; checklist: string[] }[];
};

const FR: CountryCommerceRules = {
  keywords: [
    {
      id: "tabac",
      level: "blocked",
      terms: ["cigarette", "cigarettes", "tabac a rouler", "cigare", "cigares", "tabac a chicha", "chicha tabac", "puff", "puffs", "vape jetable", "cigarette electronique jetable"],
      reason: "La vente à distance de tabac et la vente de cigarettes électroniques jetables sont interdites en France.",
    },
    {
      id: "medicaments",
      level: "blocked",
      terms: ["medicament", "medicaments", "antibiotique", "antibiotiques", "ordonnance", "sur prescription", "paracetamol", "ibuprofene", "anxiolytique", "somnifere"],
      reason: "En France, la vente en ligne de médicaments est réservée aux pharmacies autorisées.",
    },
    {
      id: "armes",
      level: "blocked",
      terms: ["arme a feu", "armes a feu", "revolver", "fusil de chasse", "fusil a pompe", "pistolet semi automatique", "carabine", "munition", "munitions", "cartouches de chasse", "poing americain"],
      reason: "Les armes à feu, munitions et armes prohibées ne peuvent pas être vendues via Publia.",
    },
    {
      id: "stupefiants",
      level: "blocked",
      terms: ["cannabis", "marijuana", "cocaine", "ecstasy", "mdma", "lsd", "poppers", "protoxyde d azote", "gaz hilarant"],
      reason: "Les stupéfiants et substances détournées sont interdits à la vente.",
    },
    {
      id: "contrefacon",
      level: "blocked",
      terms: ["contrefacon", "replica", "copie conforme", "faux sac", "rep 1:1"],
      reason: "La vente de contrefaçons est interdite.",
    },
    {
      id: "adulte",
      level: "blocked",
      terms: ["pornographique", "contenu adulte", "escort"],
      reason: "Les contenus et services pour adultes sont refusés par les prestataires de paiement.",
    },
    {
      id: "e-cigarette",
      level: "to_verify",
      terms: ["cigarette electronique", "e-liquide", "e liquide", "vapoteuse", "resistance vape"],
      reason: "Produits du vapotage : vente interdite aux mineurs, publicité encadrée, conformité des e-liquides.",
    },
    {
      id: "cbd",
      level: "to_verify",
      terms: ["cbd", "cannabidiol"],
      reason: "Produits au CBD : réglementation évolutive (taux de THC, allégations santé interdites) et souvent refusés par les prestataires de paiement.",
    },
    {
      id: "armes-blanches",
      level: "to_verify",
      terms: ["couteau", "poignard", "machette", "taser", "bombe lacrymogene", "matraque", "arbalete"],
      reason: "Certaines armes blanches et de défense sont soumises à restrictions (âge, catégorie d'arme).",
    },
    {
      id: "animaux",
      level: "to_verify",
      terms: ["chiot", "chaton", "animal vivant", "animaux vivants", "oiseau vivant", "reptile vivant"],
      reason: "La vente d'animaux vivants est strictement encadrée (identification, certificat, statut d'éleveur).",
    },
    {
      id: "allegations-sante",
      level: "to_verify",
      terms: ["guerit", "anti cancer", "anticancer", "minceur garantie", "perte de poids garantie"],
      reason: "Les allégations de santé ou thérapeutiques sont interdites sans autorisation.",
    },
  ],
  categories: {
    beaute: {
      checklist: [
        "Le produit est conforme au règlement cosmétique européen (personne responsable, notification CPNP).",
        "La liste des ingrédients (INCI) et la durée après ouverture figurent sur l'emballage.",
        "La description ne contient aucune allégation thérapeutique.",
      ],
    },
    soin: {
      checklist: [
        "Le produit n'est pas un médicament ni un dispositif médical.",
        "La composition et les précautions d'emploi sont indiquées.",
        "La description ne contient aucune allégation thérapeutique.",
      ],
    },
    alimentation: {
      checklist: [
        "Les ingrédients et les 14 allergènes réglementaires sont indiqués.",
        "La DLC ou la DDM, le poids net et les conditions de conservation sont respectés.",
        "Mon activité est déclarée auprès des services compétents pour la vente de denrées alimentaires.",
      ],
    },
    boissons: {
      checklist: [
        "La composition et la contenance sont indiquées.",
        "Le produit respecte les règles d'étiquetage applicables aux boissons.",
      ],
    },
    jouets: {
      checklist: [
        "Le jouet porte le marquage CE.",
        "L'âge minimum et les avertissements de sécurité sont indiqués.",
      ],
    },
  },
  attributeChecks: [
    {
      category: "boissons",
      key: "alcool",
      equals: true,
      checklist: [
        "Je ne vends pas d'alcool aux mineurs et je vérifierai l'âge à la livraison ou au retrait.",
        "J'afficherai la mention « L'abus d'alcool est dangereux pour la santé, à consommer avec modération ».",
        "Je dispose de la licence ou de l'autorisation de vente d'alcool requise.",
      ],
    },
  ],
};

export const COMMERCE_RULES: Record<string, CountryCommerceRules> = { FR };

export function rulesFor(country: string) {
  return COMMERCE_RULES[country] ?? FR;
}

function normalize(s: string) {
  return ` ${s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9:]+/g, " ")
    .trim()} `;
}

export type ComplianceInput = {
  country: string;
  categoryId: string;
  regulated: boolean;
  text: string;
  attributes: Record<string, unknown>;
};

export type ComplianceResult = { level: ComplianceLevel; reasons: string[]; checklist: string[] };

/** Contrôle de conformité d'un produit (pur, testable). */
export function checkCompliance({ country, categoryId, regulated, text, attributes }: ComplianceInput): ComplianceResult {
  const rules = rulesFor(country);
  const hay = normalize(text);
  const reasons: string[] = [];
  const checklist: string[] = [];
  let level: ComplianceLevel = "ok";

  for (const r of rules.keywords) {
    if (r.terms.some((t) => hay.includes(` ${normalize(t).trim()} `))) {
      reasons.push(r.reason);
      if (r.level === "blocked") level = "blocked";
      else if (level === "ok") level = "to_verify";
    }
  }

  const cat = rules.categories[categoryId];
  if (cat) checklist.push(...cat.checklist);
  else if (regulated) checklist.push("Je confirme que ce produit respecte la réglementation applicable à sa catégorie.");

  for (const a of rules.attributeChecks) {
    if (a.category === categoryId && attributes[a.key] === a.equals) checklist.push(...a.checklist);
  }

  if (level === "ok" && checklist.length) level = "to_verify";
  if (level === "to_verify" && !checklist.length) checklist.push("J'ai vérifié que la vente de ce produit est autorisée et je respecte les obligations qui s'y appliquent.");
  return { level, reasons, checklist: Array.from(new Set(checklist)) };
}
