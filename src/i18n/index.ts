// Système i18n de Publia. Seul le français est actif au lancement.
// Les dictionnaires sont chargés statiquement (pas de dépendance externe) ;
// la langue est résolue depuis la configuration centrale des marchés.

import { DEFAULT_LOCALE, getMarket, type LocaleCode } from "@/config/markets";
import { fr, type Messages } from "./messages/fr";

const DICTIONARIES: Record<LocaleCode, Messages> = { fr };

/** Langue effective : celle demandée si elle est active sur le marché, sinon la langue par défaut. */
export function resolveLocale(requested?: string | null, marketCode?: string | null): LocaleCode {
  const market = getMarket(marketCode);
  return market.locales.includes(requested as LocaleCode) ? (requested as LocaleCode) : market.locales[0] ?? DEFAULT_LOCALE;
}

export function getMessages(locale: LocaleCode = DEFAULT_LOCALE): Messages {
  return DICTIONARIES[locale] ?? DICTIONARIES[DEFAULT_LOCALE];
}

// Accès par chemin typé : t("nav.items.dashboard").
type Paths<T, P extends string = ""> = {
  [K in keyof T & string]: T[K] extends string ? `${P}${K}` : T[K] extends readonly unknown[] ? never : Paths<T[K], `${P}${K}.`>;
}[keyof T & string];
export type MessageKey = Paths<Messages>;

export function t(key: MessageKey, locale: LocaleCode = DEFAULT_LOCALE): string {
  const value = key.split(".").reduce<unknown>((o, k) => (o as Record<string, unknown>)?.[k], getMessages(locale));
  return typeof value === "string" ? value : key;
}

export const messages = getMessages();
