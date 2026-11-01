// Formatage centralisé (devise, nombres, dates) selon le marché.
// Ne jamais appeler Intl avec une locale ou une devise écrite en dur ailleurs dans le code.

import { getMarket, type Market } from "@/config/markets";

type M = Market | string | null | undefined;
const mk = (m: M) => (typeof m === "object" && m ? m : getMarket(m as string | null | undefined));

/** Montant en centimes → texte (« 19,90 € »). */
export function formatMoney(cents: number, market?: M, opts: { trimZeros?: boolean } = { trimZeros: true }) {
  const m = mk(market);
  return new Intl.NumberFormat(m.intlLocale, {
    style: "currency",
    currency: m.currency,
    minimumFractionDigits: opts.trimZeros && cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);
}

export function formatNumber(n: number, market?: M) {
  return new Intl.NumberFormat(mk(market).intlLocale).format(n);
}

/** Date calendaire YYYY-MM-DD (sans heure) → texte, indépendamment du fuseau. */
export function formatDay(day: string, style: "long" | "short" | "weekdayShort" | "month" | "dayMonthYear" = "long", market?: M) {
  const options: Record<typeof style, Intl.DateTimeFormatOptions> = {
    long: { weekday: "long", day: "numeric", month: "long" },
    short: { day: "numeric", month: "short" },
    weekdayShort: { weekday: "short", day: "numeric" },
    month: { month: "long", year: "numeric" },
    dayMonthYear: { day: "numeric", month: "short", year: "numeric" },
  };
  return new Intl.DateTimeFormat(mk(market).intlLocale, { ...options[style], timeZone: "UTC" }).format(new Date(`${day}T12:00:00Z`));
}

/** Instant → texte dans le fuseau du marché. */
export function formatInstant(date: Date | string, style: "time" | "full" | "dayMonthYear" = "full", market?: M) {
  const m = mk(market);
  const options: Record<typeof style, Intl.DateTimeFormatOptions> = {
    time: { hour: "2-digit", minute: "2-digit" },
    full: { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" },
    dayMonthYear: { day: "numeric", month: "short", year: "numeric" },
  };
  return new Intl.DateTimeFormat(m.intlLocale, { ...options[style], timeZone: m.timezone }).format(typeof date === "string" ? new Date(date) : date);
}
