// Offres par défaut. Les valeurs définitives seront stockées en base (table plans)
// et modifiables depuis l'administration (phase 7).

export type PlanId = "free" | "starter" | "premium";

export type Plan = {
  id: PlanId;
  name: string;
  priceLabel: string;
  monthlyPosts: number;
  monthlyVideoCredits: number;
  features: string[];
};

export const PLANS: Plan[] = [
  {
    id: "free",
    name: "Gratuit",
    priceLabel: "0 €",
    monthlyPosts: 3,
    monthlyVideoCredits: 0,
    features: ["3 générations de publications", "Modèles de base", "Découverte de l'application"],
  },
  {
    id: "starter",
    name: "Starter",
    priceLabel: "19,90 € TTC / mois",
    monthlyPosts: 30,
    monthlyVideoCredits: 0,
    features: [
      "30 générations de publications par mois",
      "Modèles graphiques et création de visuels",
      "Historique des créations",
      "Téléchargement PNG",
      "1 commerce",
    ],
  },
  {
    id: "premium",
    name: "Premium",
    priceLabel: "39,90 € TTC / mois",
    monthlyPosts: 60,
    monthlyVideoCredits: 5,
    features: [
      "60 générations de publications par mois",
      "5 crédits vidéo IA par mois",
      "Tous les modèles",
      "YouTube Shorts, vidéos 16:9 et miniatures",
      "Historique complet",
    ],
  },
];

export const planById = (id: string | null | undefined): Plan =>
  PLANS.find((p) => p.id === id) ?? PLANS[0];
