// AdBudgetManager : contrôles de budget. Les dépenses sont facturées par les régies,
// séparément de l'abonnement Publia. Aucun budget n'est engagé sans validation explicite.

export const BUDGET_RULES = {
  dailyMinCents: 100, // 1 €
  dailyMaxCents: 100_000, // 1 000 €
  maxDays: 90,
};

export function daysBetween(start: string, end: string) {
  const a = Date.parse(`${start}T12:00:00Z`);
  const b = Date.parse(`${end}T12:00:00Z`);
  return Math.round((b - a) / 86_400_000) + 1;
}

export type BudgetCheck = { ok: true; days: number; plannedCents: number } | { ok: false; error: string };

export function checkBudget({
  dailyCents,
  capCents,
  start,
  end,
  today,
}: {
  dailyCents: number;
  capCents: number;
  start: string;
  end: string;
  today: string;
}): BudgetCheck {
  if (!Number.isInteger(dailyCents) || dailyCents < BUDGET_RULES.dailyMinCents) return { ok: false, error: "Budget quotidien minimum : 1 €." };
  if (dailyCents > BUDGET_RULES.dailyMaxCents) return { ok: false, error: "Budget quotidien maximum dans Publia : 1 000 €." };
  if (start < today) return { ok: false, error: "La date de début ne peut pas être dans le passé." };
  const days = daysBetween(start, end);
  if (days < 1) return { ok: false, error: "La date de fin doit suivre la date de début." };
  if (days > BUDGET_RULES.maxDays) return { ok: false, error: `Durée maximale : ${BUDGET_RULES.maxDays} jours.` };
  const plannedCents = dailyCents * days;
  if (capCents < dailyCents) return { ok: false, error: "Le plafond de dépense doit être au moins égal au budget quotidien." };
  if (capCents > plannedCents) return { ok: false, error: "Le plafond ne peut pas dépasser le budget total prévu." };
  return { ok: true, days, plannedCents };
}

export const euros = (cents: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", minimumFractionDigits: cents % 100 ? 2 : 0 }).format(cents / 100);
