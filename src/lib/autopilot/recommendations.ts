// PublishingRecommendations : créneaux de départ, puis apprentissage à partir des résultats réels.
//
// Sans statistiques de compte connectées, Publia ne prétend PAS connaître l'audience :
// il propose des horaires de départ génériques (confiance « faible ») et l'indique clairement.
// Quand des performances réelles seront disponibles (connexion officielle des comptes), la
// confiance augmentera et les créneaux seront recalculés à partir de ces données.

import type { SchedPlatform } from "./scheduler";

export type Recommendation = {
  platform: SchedPlatform;
  time: string;
  days: number[];
  alternatives: string[];
  confidence: "faible" | "moyenne" | "élevée";
  justification: string;
};

type Base = { time: string; days: number[]; alternatives: string[] };

const STARTING_SLOTS: Record<SchedPlatform, Base> = {
  instagram: { time: "18:30", days: [1, 3, 5], alternatives: ["12:15", "20:30"] },
  facebook: { time: "12:30", days: [2, 4], alternatives: ["18:00", "09:00"] },
  tiktok: { time: "19:30", days: [3, 6], alternatives: ["12:30", "21:00"] },
  youtube: { time: "17:30", days: [5], alternatives: ["12:00", "19:00"] },
};

// Ajustements selon le rythme du métier (logique d'usage, pas une statistique).
const SECTOR_RULES: { match: RegExp; shift: Partial<Record<SchedPlatform, Partial<Base>>>; reason: string }[] = [
  {
    match: /restaurant|café|bar|boulangerie|pâtisserie/i,
    shift: { instagram: { time: "11:00", alternatives: ["17:30", "19:00"] }, facebook: { time: "10:30", alternatives: ["17:00"] } },
    reason: "publication avant les services du midi et du soir, quand les clients choisissent où manger",
  },
  {
    match: /coiffeur|barbier|beauté|bien-être/i,
    shift: { instagram: { time: "20:00", alternatives: ["12:30", "18:30"] }, facebook: { time: "19:00", alternatives: ["12:30"] } },
    reason: "publication en soirée, moment où l'on planifie ses rendez-vous",
  },
  {
    match: /boutique|commerce|fleuriste/i,
    shift: { instagram: { time: "18:00", alternatives: ["12:30", "10:00"] } },
    reason: "publication en fin de journée et avant le week-end, propices au shopping",
  },
];

export function recommendSlots(platforms: readonly SchedPlatform[], sector: string | null): Recommendation[] {
  const rule = sector ? SECTOR_RULES.find((r) => r.match.test(sector)) : undefined;
  return platforms.map((platform) => {
    const base = { ...STARTING_SLOTS[platform], ...(rule?.shift[platform] ?? {}) };
    return {
      platform,
      ...base,
      confidence: "faible" as const,
      justification: `Horaire de départ${rule?.shift[platform] ? ` adapté à votre métier (${rule.reason})` : " couramment utilisé par les commerces de proximité"}. Vos comptes ne sont pas encore connectés : Publia ne dispose d'aucune statistique de votre audience. L'horaire sera affiné à partir de vos résultats réels.`,
    };
  });
}
