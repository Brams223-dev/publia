import "server-only";
// Paiement : interface commune à tous les fournisseurs, choisis par marché (src/config/markets.ts).
// Aucune intégration n'est active au lancement : aucun paiement n'est simulé.
// Une intégration (ex. Stripe pour la France) s'ajoute en implémentant PaymentProvider,
// puis en l'enregistrant dans IMPLEMENTATIONS après vérification (compte, conformité, webhooks).

import { getMarket, type PaymentProviderId } from "@/config/markets";

export type CheckoutRequest = {
  userId: string;
  email: string;
  plan: string;
  marketCode: string;
  successUrl: string;
  cancelUrl: string;
};

export type PaymentProvider = {
  id: PaymentProviderId;
  isConfigured: () => boolean;
  /** Crée une session de paiement hébergée par le fournisseur et renvoie son URL. */
  createCheckout: (req: CheckoutRequest) => Promise<{ url: string }>;
  /** Portail client (factures, moyen de paiement, résiliation). */
  createPortal: (userId: string, returnUrl: string) => Promise<{ url: string }>;
  /** Vérifie la signature d'un webhook et renvoie l'événement normalisé. */
  verifyWebhook: (payload: string, signature: string) => Promise<{ type: string; data: unknown }>;
};

const IMPLEMENTATIONS: Partial<Record<PaymentProviderId, PaymentProvider>> = {
  // stripe: à implémenter (phase paiement) — STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET.
};

/** Fournisseur de paiement disponible pour un marché, ou null s'il n'est pas encore intégré. */
export function getPaymentProvider(marketCode?: string): PaymentProvider | null {
  for (const id of getMarket(marketCode).paymentProviders) {
    const p = IMPLEMENTATIONS[id];
    if (p?.isConfigured()) return p;
  }
  return null;
}

export const isPaymentAvailable = (marketCode?: string) => getPaymentProvider(marketCode) !== null;
