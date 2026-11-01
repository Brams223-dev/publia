// =============================================================================
// Configuration des marchés — SOURCE UNIQUE pour pays, langue, devise, fuseau,
// taxe, moyens de paiement et support. Aucun de ces paramètres ne doit être
// codé en dur ailleurs : utiliser getMarket() et les helpers de src/lib/format.ts.
//
// Lancement V1 : France uniquement.
//
// Activer un nouveau marché exige, AVANT de passer `active: true` :
//   1. Vérification technique (API IA, paiement, réseaux sociaux disponibles dans le pays).
//   2. Vérification commerciale (prix, offres, support dans la langue du marché).
//   3. Vérification fiscale (TVA / taxes, facturation, obligations locales).
//   4. Vérification réglementaire (protection des données, consommation, publicité).
//   5. Traductions complètes de l'interface et des contenus IA.
//   6. Ligne de prix dans `plan_prices` et taux dans `tax_rates` (Supabase).
// =============================================================================

export type CountryCode = "FR";
export type LocaleCode = "fr";
export type CurrencyCode = "EUR";
export type PaymentProviderId = "stripe";

export type Market = {
  code: CountryCode;
  name: string;
  active: boolean;
  /** Langues proposées sur ce marché (la première est la langue par défaut). */
  locales: LocaleCode[];
  /** Locale de formatage Intl (dates, nombres, devises). */
  intlLocale: string;
  currency: CurrencyCode;
  timezone: string;
  tax: { label: string; pricesIncludeTax: boolean };
  /** Moyens de paiement retenus pour ce marché (intégration à réaliser et vérifier). */
  paymentProviders: PaymentProviderId[];
  supportLanguage: LocaleCode;
  legal: { consumerWithdrawalDays: number };
};

export const MARKETS: Record<CountryCode, Market> = {
  FR: {
    code: "FR",
    name: "France",
    active: true,
    locales: ["fr"],
    intlLocale: "fr-FR",
    currency: "EUR",
    timezone: "Europe/Paris",
    tax: { label: "TVA", pricesIncludeTax: true },
    paymentProviders: ["stripe"],
    supportLanguage: "fr",
    legal: { consumerWithdrawalDays: 14 },
  },
};

export const DEFAULT_MARKET: CountryCode = "FR";
export const DEFAULT_LOCALE: LocaleCode = "fr";

export const ACTIVE_MARKETS = Object.values(MARKETS).filter((m) => m.active);

/** Marché d'un commerce (ou marché par défaut). Un code inconnu ou inactif retombe sur la France. */
export function getMarket(code?: string | null): Market {
  const m = code ? MARKETS[code as CountryCode] : undefined;
  return m && m.active ? m : MARKETS[DEFAULT_MARKET];
}

export function isActiveMarket(code: string): code is CountryCode {
  return Boolean(MARKETS[code as CountryCode]?.active);
}
