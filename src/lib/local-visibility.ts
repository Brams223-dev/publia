// Visibilité locale : score et actions concrètes, calculés uniquement à partir de données réelles
// (profil du commerce, mini-site, avis, catalogue) et des vérifications déclarées par le commerçant
// pour sa fiche Google (aucune API Google n'est interrogée). Module pur, testable.

export type VisibilityInput = {
  business: {
    name: string;
    category: string | null;
    description: string | null;
    address: string | null;
    city: string | null;
    phone: string | null;
    website: string | null;
    opening_hours: string | null;
    logo_url: string | null;
    social_links: Record<string, string | undefined>;
  };
  photos: number;
  minisitePublished: boolean;
  minisiteShowsAddress: boolean;
  activeProducts: number;
  publishedReviews: number;
  recentReviews: number; // 90 derniers jours
  repliedReviews: number;
  declared: Record<string, boolean>; // vérifications de la fiche Google cochées par le commerçant
};

export type VisibilityCheck = {
  id: string;
  group: "profil" | "site" | "avis" | "google";
  label: string;
  done: boolean;
  points: number;
  advice: string;
  href?: string;
  declared?: boolean;
};

export const GOOGLE_CHECKLIST: { id: string; label: string; advice: string; points: number }[] = [
  { id: "gbp_claimed", label: "Fiche Google Business Profile revendiquée et validée", advice: "Créez ou revendiquez votre fiche sur business.google.com : c'est elle qui apparaît dans Google Maps.", points: 12 },
  { id: "gbp_same_info", label: "Nom, adresse et téléphone identiques à ceux de Publia", advice: "Copiez exactement le bloc « Coordonnées » ci-dessous : des informations différentes d'un site à l'autre font baisser votre classement local.", points: 8 },
  { id: "gbp_category", label: "Catégorie principale précise choisie", advice: "Choisissez la catégorie la plus précise (ex. « Fleuriste » plutôt que « Magasin »).", points: 5 },
  { id: "gbp_hours", label: "Horaires à jour, y compris jours fériés", advice: "Mettez à jour vos horaires exceptionnels avant chaque jour férié et chaque fermeture.", points: 5 },
  { id: "gbp_photos", label: "Au moins 10 photos récentes sur la fiche", advice: "Ajoutez des photos de la devanture, de l'intérieur, de l'équipe et de vos produits.", points: 5 },
  { id: "gbp_website", label: "Lien vers votre site ou mini-site renseigné", advice: "Indiquez l'adresse de votre mini-site Publia comme site web de la fiche.", points: 4 },
  { id: "gbp_posts", label: "Une publication sur la fiche au moins une fois par mois", advice: "Publiez une nouveauté ou une offre chaque mois : vous pouvez réutiliser vos contenus Publia.", points: 4 },
];

const has = (v: string | null | undefined, min = 1) => Boolean(v && v.trim().length >= min);

export function computeVisibility(i: VisibilityInput) {
  const b = i.business;
  const socials = Object.values(b.social_links ?? {}).filter((v) => has(v)).length;
  const checks: VisibilityCheck[] = [
    { id: "category", group: "profil", label: "Secteur d'activité renseigné", done: has(b.category), points: 4, advice: "Indiquez votre secteur dans « Mon commerce ».", href: "/mon-commerce" },
    { id: "description", group: "profil", label: "Description d'au moins 150 caractères", done: has(b.description, 150), points: 6, advice: "Décrivez ce que vous proposez, pour qui, et ce qui vous distingue, avec les mots que vos clients recherchent.", href: "/mon-commerce" },
    { id: "address", group: "profil", label: "Adresse et ville complètes", done: has(b.address) && has(b.city), points: 8, advice: "Une adresse complète est indispensable pour apparaître dans les recherches « près de moi ».", href: "/mon-commerce" },
    { id: "phone", group: "profil", label: "Téléphone renseigné", done: has(b.phone), points: 4, advice: "Ajoutez un numéro joignable aux heures d'ouverture.", href: "/mon-commerce" },
    { id: "hours", group: "profil", label: "Horaires d'ouverture renseignés", done: has(b.opening_hours), points: 5, advice: "Les clients vérifient les horaires avant de se déplacer.", href: "/mon-commerce" },
    { id: "logo", group: "profil", label: "Logo ajouté", done: has(b.logo_url), points: 3, advice: "Un logo rend votre commerce reconnaissable sur toutes vos pages.", href: "/mon-commerce" },
    { id: "photos", group: "profil", label: "Au moins 3 photos du commerce", done: i.photos >= 3, points: 4, advice: `Ajoutez des photos (${i.photos}/3) : devanture, intérieur, produits.`, href: "/mon-commerce" },
    { id: "socials", group: "profil", label: "Au moins un réseau social renseigné", done: socials >= 1, points: 2, advice: "Indiquez vos comptes Instagram, Facebook ou TikTok.", href: "/mon-commerce" },
    { id: "minisite", group: "site", label: "Mini-site en ligne", done: i.minisitePublished, points: 8, advice: "Publiez votre mini-site : une page web à votre nom, avec vos informations à jour, aide votre référencement.", href: "/mini-site" },
    { id: "minisite_address", group: "site", label: "Adresse affichée sur le mini-site", done: i.minisitePublished && i.minisiteShowsAddress && has(b.address), points: 3, advice: "Affichez votre adresse sur le mini-site pour qu'elle soit identique partout.", href: "/mini-site" },
    { id: "catalogue", group: "site", label: "Au moins 3 produits ou services en ligne", done: i.activeProducts >= 3, points: 4, advice: `Activez vos produits ou prestations (${i.activeProducts}/3) : ils apparaissent sur le mini-site.`, href: "/catalogue" },
    { id: "reviews_5", group: "avis", label: "Au moins 5 avis publiés", done: i.publishedReviews >= 5, points: 6, advice: `Envoyez votre lien d'avis à vos clients (${i.publishedReviews}/5), sans le réserver aux clients satisfaits.`, href: "/avis" },
    { id: "reviews_recent", group: "avis", label: "Au moins un avis ces 3 derniers mois", done: i.recentReviews >= 1, points: 4, advice: "Des avis récents montrent que votre commerce est actif : demandez-en régulièrement.", href: "/avis" },
    {
      id: "reviews_replied", group: "avis", label: "Réponse à la majorité des avis", done: i.publishedReviews > 0 && i.repliedReviews / i.publishedReviews >= 0.5, points: 4,
      advice: i.publishedReviews ? `Vous avez répondu à ${i.repliedReviews} avis sur ${i.publishedReviews}. Répondre, surtout aux avis négatifs, rassure les futurs clients.` : "Répondez à chaque avis dès qu'il arrive.",
      href: "/avis",
    },
    ...GOOGLE_CHECKLIST.map((g) => ({ id: g.id, group: "google" as const, label: g.label, done: Boolean(i.declared[g.id]), points: g.points, advice: g.advice, declared: true })),
  ];
  const max = checks.reduce((s, c) => s + c.points, 0);
  const got = checks.filter((c) => c.done).reduce((s, c) => s + c.points, 0);
  const score = Math.round((got / max) * 100);
  const level = score >= 80 ? "Excellente" : score >= 60 ? "Bonne" : score >= 35 ? "À renforcer" : "Faible";
  // Priorités : actions non faites, les plus rentables d'abord.
  const priorities = checks.filter((c) => !c.done).sort((a, b) => b.points - a.points).slice(0, 3);
  return { checks, score, level, priorities };
}

/** Bloc nom / adresse / téléphone à recopier à l'identique sur tous les annuaires. */
export function napBlock(b: VisibilityInput["business"], siteUrl: string | null) {
  return [b.name, [b.address, b.city].filter(Boolean).join(", "), b.phone, siteUrl ?? b.website].filter(Boolean).join("\n");
}
