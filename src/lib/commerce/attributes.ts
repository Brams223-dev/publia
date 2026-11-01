// Validation typée des attributs dynamiques d'un produit, d'après le schéma de sa catégorie.
// Pur et sans dépendance serveur : utilisé par les actions serveur et testable isolément.

import type { AttributeDef } from "./config";

export type AttributeValue = string | number | boolean | string[];
export type AttributeResult = { values: Record<string, AttributeValue>; errors: string[] };

const TEXT_MAX = 300;
const TEXTAREA_MAX = 3000;
const CUSTOM_MAX = 20;
const KEY_RE = /^[a-z0-9_]{1,40}$/;

function isEmpty(v: unknown) {
  return v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0);
}

function coerce(def: AttributeDef, raw: unknown): { value?: AttributeValue; error?: string } {
  switch (def.type) {
    case "text":
    case "textarea": {
      const s = String(raw).trim();
      const max = def.type === "text" ? TEXT_MAX : TEXTAREA_MAX;
      if (s.length > max) return { error: `${def.label} : ${max} caractères maximum.` };
      return { value: s };
    }
    case "number": {
      const n = typeof raw === "number" ? raw : Number(String(raw).replace(",", ".").trim());
      if (!Number.isFinite(n)) return { error: `${def.label} : nombre attendu.` };
      if (n < 0 || n > 1e9) return { error: `${def.label} : valeur hors limites.` };
      return { value: Math.round(n * 1000) / 1000 };
    }
    case "boolean": {
      if (typeof raw === "boolean") return { value: raw };
      const s = String(raw).toLowerCase();
      if (["true", "on", "1", "oui"].includes(s)) return { value: true };
      if (["false", "off", "0", "non"].includes(s)) return { value: false };
      return { error: `${def.label} : oui ou non attendu.` };
    }
    case "select": {
      const s = String(raw).trim();
      if (!def.options?.includes(s)) return { error: `${def.label} : choix non proposé.` };
      return { value: s };
    }
    case "multiselect": {
      const list = (Array.isArray(raw) ? raw : String(raw).split(",")).map((x) => String(x).trim()).filter(Boolean);
      const bad = list.find((x) => !def.options?.includes(x));
      if (bad) return { error: `${def.label} : « ${bad} » n'est pas un choix proposé.` };
      return { value: Array.from(new Set(list)) };
    }
    case "date": {
      const s = String(raw).trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || Number.isNaN(Date.parse(`${s}T00:00:00Z`))) return { error: `${def.label} : date invalide.` };
      return { value: s };
    }
  }
}

/**
 * Valide les valeurs saisies contre le schéma de la catégorie.
 * - les clés connues sont converties dans leur type et vérifiées ;
 * - les attributs obligatoires manquants sont signalés (sauf `allowMissingRequired`, pour un brouillon) ;
 * - les attributs libres (« custom:<clé> ») sont acceptés en texte, en nombre limité.
 */
export function validateAttributes(
  schema: AttributeDef[],
  raw: Record<string, unknown>,
  { allowMissingRequired = false }: { allowMissingRequired?: boolean } = {},
): AttributeResult {
  const values: Record<string, AttributeValue> = {};
  const errors: string[] = [];
  const known = new Map(schema.map((d) => [d.key, d]));

  for (const def of schema) {
    const v = raw[def.key];
    if (isEmpty(v)) {
      if (def.required && !allowMissingRequired) errors.push(`${def.label} est obligatoire pour cette catégorie.`);
      continue;
    }
    const r = coerce(def, v);
    if (r.error) errors.push(r.error);
    else if (r.value !== undefined && !isEmpty(r.value)) values[def.key] = r.value;
  }

  let custom = 0;
  for (const [k, v] of Object.entries(raw)) {
    if (known.has(k) || !k.startsWith("custom:") || isEmpty(v)) continue;
    const key = k.slice(7);
    if (!KEY_RE.test(key)) {
      errors.push("Nom de caractéristique personnalisée invalide.");
      continue;
    }
    if (++custom > CUSTOM_MAX) {
      errors.push(`${CUSTOM_MAX} caractéristiques personnalisées maximum.`);
      break;
    }
    const s = String(v).trim().slice(0, TEXT_MAX);
    if (s) values[k] = s;
  }

  return { values, errors };
}

/** Attributs obligatoires non renseignés (pour signaler une fiche incomplète). */
export function missingRequired(schema: AttributeDef[], values: Record<string, unknown>) {
  return schema.filter((d) => d.required && isEmpty(values[d.key])).map((d) => d.label);
}

/** Affichage lisible d'une valeur d'attribut. */
export function displayValue(def: AttributeDef | undefined, v: AttributeValue) {
  if (Array.isArray(v)) return v.join(", ");
  if (typeof v === "boolean") return v ? "Oui" : "Non";
  if (typeof v === "number") return `${v.toLocaleString("fr-FR")}${def?.unit ? ` ${def.unit}` : ""}`;
  return v;
}

/** Libellé d'une caractéristique personnalisée « custom:matiere_doublure » → « Matiere doublure ». */
export function customLabel(key: string) {
  const s = key.replace(/^custom:/, "").replace(/_/g, " ");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function slugKey(label: string) {
  return label
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 40);
}
