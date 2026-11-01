// Outils de fuseau horaire sans dépendance (Intl). Fuseau par défaut : celui du marché (config centrale).

import { getMarket } from "@/config/markets";
import { formatDay, formatInstant } from "@/lib/format";

export const DEFAULT_TZ = getMarket().timezone;

function parts(date: Date, tz: string) {
  const f = new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
    weekday: "short",
  });
  const p = Object.fromEntries(f.formatToParts(date).map((x) => [x.type, x.value]));
  return {
    year: +p.year,
    month: +p.month,
    day: +p.day,
    hour: +p.hour,
    minute: +p.minute,
    second: +p.second,
    weekday: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(p.weekday) + 1, // ISO 1 = lundi
  };
}

/** Décalage (ms) du fuseau par rapport à UTC à un instant donné. */
function offsetMs(date: Date, tz: string) {
  const p = parts(date, tz);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

/** Heure murale locale (YYYY-MM-DD + HH:MM dans `tz`) → instant UTC. Gère les changements d'heure. */
export function zonedToUtc(day: string, time: string, tz = DEFAULT_TZ): Date {
  const [y, m, d] = day.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  let ts = guess - offsetMs(new Date(guess), tz);
  ts = guess - offsetMs(new Date(ts), tz); // seconde passe : bascule été/hiver
  return new Date(ts);
}

/** Jour local (YYYY-MM-DD) et jour ISO de la semaine d'un instant dans `tz`. */
export function localDay(date: Date, tz = DEFAULT_TZ) {
  const p = parts(date, tz);
  const iso = `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
  return { iso, weekday: p.weekday, time: `${String(p.hour).padStart(2, "0")}:${String(p.minute).padStart(2, "0")}` };
}

/** Ajoute n jours à une date locale YYYY-MM-DD. */
export function addDays(day: string, n: number) {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Lundi de la semaine contenant `day`. */
export function startOfWeek(day: string) {
  const wd = (new Date(`${day}T12:00:00Z`).getUTCDay() + 6) % 7; // 0 = lundi
  return addDays(day, -wd);
}

// Raccourcis de formatage (délèguent au formatage centralisé du marché).
export const fmt = {
  time: (d: Date) => formatInstant(d, "time"),
  dayLong: (day: string) => formatDay(day, "long"),
  dayShort: (day: string) => formatDay(day, "weekdayShort"),
  month: (day: string) => formatDay(day, "month"),
  full: (d: Date) => formatInstant(d, "full"),
};

export const WEEKDAYS = [
  { iso: 1, short: "L", label: "Lundi" },
  { iso: 2, short: "M", label: "Mardi" },
  { iso: 3, short: "M", label: "Mercredi" },
  { iso: 4, short: "J", label: "Jeudi" },
  { iso: 5, short: "V", label: "Vendredi" },
  { iso: 6, short: "S", label: "Samedi" },
  { iso: 7, short: "D", label: "Dimanche" },
];
