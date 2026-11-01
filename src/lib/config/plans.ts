// Présentation des offres sur la page publique.
// La source de vérité des quotas est la table `plan_limits` (Supabase), modifiable par l'administration.
// Prix et quotas à valider selon les coûts réels des API avant le lancement commercial.

export type PlanId = "free" | "starter" | "pro" | "business";

export type Plan = { id: PlanId; name: string; priceLabel: string; highlight?: boolean; features: string[] };

export const PLANS: Plan[] = [
  {
    id: "free",
    name: "Free",
    priceLabel: "0 €",
    features: ["3 générations par mois", "Fais ma communication", "Profil de marque"],
  },
  {
    id: "starter",
    name: "Starter",
    priceLabel: "19,90 € / mois",
    features: ["30 générations par mois", "Campagnes multi-réseaux", "Studio visuel et export PNG", "Historique des créations"],
  },
  {
    id: "pro",
    name: "Pro",
    priceLabel: "39,90 € / mois",
    highlight: true,
    features: ["60 générations par mois", "5 crédits vidéo par mois", "YouTube Studio et miniatures", "Assistant marketing"],
  },
  {
    id: "business",
    name: "Business",
    priceLabel: "59,90 € / mois",
    features: ["150 générations par mois", "15 crédits vidéo par mois", "Avis clients et visibilité locale", "Contacts, fidélité et mini-site"],
  },
];
