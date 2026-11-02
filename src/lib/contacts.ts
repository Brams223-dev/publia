// Contacts : normalisation, import et export CSV (module pur, testable).
// Format CSV compatible Excel français (séparateur « ; », BOM UTF-8) et virgule acceptée à l'import.

export type ContactInput = {
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  tags: string[];
  notes: string | null;
  marketing_consent: boolean;
};

export const CONTACT_LIMITS = { importMaxRows: 2000, tagsMax: 20, tagMax: 30 } as const;

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export function normalizeEmail(v: string | null | undefined) {
  const s = (v ?? "").trim().toLowerCase();
  return s && EMAIL_RE.test(s) && s.length <= 254 ? s : null;
}

/** Téléphone : chiffres et « + » initial ; numéros français 06… gardés tels quels. */
export function normalizePhone(v: string | null | undefined) {
  const raw = (v ?? "").trim();
  if (!raw) return null;
  const s = raw.replace(/[^\d+]/g, "").replace(/(?!^)\+/g, "");
  return s.replace(/\D/g, "").length >= 6 && s.length <= 20 ? s : null;
}

export function normalizeTags(v: string | string[] | null | undefined) {
  const list = Array.isArray(v) ? v : (v ?? "").split(/[,|]/);
  return Array.from(
    new Set(list.map((t) => t.trim().toLowerCase().replace(/\s+/g, " ").slice(0, CONTACT_LIMITS.tagMax)).filter(Boolean)),
  ).slice(0, CONTACT_LIMITS.tagsMax);
}

const clean = (v: string | null | undefined, max: number) => {
  const s = (v ?? "").trim().slice(0, max);
  return s || null;
};

export function displayName(c: { first_name: string | null; last_name: string | null; email?: string | null; phone?: string | null }) {
  return [c.first_name, c.last_name].filter(Boolean).join(" ") || c.email || c.phone || "Sans nom";
}

// ---------------------------------------------------------------------------
// CSV
// ---------------------------------------------------------------------------
/** Analyse un CSV (guillemets, séparateur « ; » ou « , » détecté sur la première ligne). Les lignes vides sont conservées pour garder la numérotation. */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^﻿/, "");
  const firstLine = src.split(/\r?\n/, 1)[0] ?? "";
  const sep = (firstLine.match(/;/g)?.length ?? 0) >= (firstLine.match(/,/g)?.length ?? 0) ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === sep) {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += ch;
  }
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

const HEADERS: Record<keyof ContactInput, string[]> = {
  first_name: ["prenom", "prénom", "first name", "firstname", "first_name"],
  last_name: ["nom", "last name", "lastname", "last_name", "nom de famille"],
  email: ["email", "e-mail", "mail", "adresse e-mail", "adresse email", "courriel"],
  phone: ["telephone", "téléphone", "tel", "tél", "phone", "mobile", "portable"],
  tags: ["etiquettes", "étiquettes", "tags", "groupe", "groupes"],
  notes: ["notes", "note", "commentaire", "commentaires"],
  marketing_consent: ["consentement", "consentement marketing", "accepte les offres", "newsletter", "opt-in", "optin"],
};
const fold = (s: string) => s.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const YES = new Set(["oui", "yes", "y", "1", "true", "vrai", "x"]);

export type ImportResult = { rows: ContactInput[]; skipped: { line: number; reason: string }[]; mapped: string[] };

/** Convertit un CSV en contacts. Le consentement n'est retenu que s'il est explicitement indiqué « oui ». */
export function contactsFromCsv(text: string): ImportResult {
  const table = parseCsv(text);
  if (!table.length) return { rows: [], skipped: [], mapped: [] };
  const header = table[0].map(fold);
  const col = {} as Record<keyof ContactInput, number>;
  for (const [key, names] of Object.entries(HEADERS) as [keyof ContactInput, string[]][]) {
    col[key] = header.findIndex((h) => names.map(fold).includes(h));
  }
  const mapped = (Object.keys(col) as (keyof ContactInput)[]).filter((k) => col[k] >= 0);
  const get = (r: string[], k: keyof ContactInput) => (col[k] >= 0 ? (r[col[k]] ?? "") : "");

  const rows: ContactInput[] = [];
  const skipped: ImportResult["skipped"] = [];
  const seen = new Set<string>();
  table.slice(1, CONTACT_LIMITS.importMaxRows + 1).forEach((r, i) => {
    const line = i + 2;
    if (r.every((v) => v.trim() === "")) return;
    const rawEmail = get(r, "email").trim();
    const email = normalizeEmail(rawEmail);
    const phone = normalizePhone(get(r, "phone"));
    const c: ContactInput = {
      first_name: clean(get(r, "first_name"), 80),
      last_name: clean(get(r, "last_name"), 80),
      email,
      phone,
      tags: normalizeTags(get(r, "tags")),
      notes: clean(get(r, "notes"), 2000),
      marketing_consent: YES.has(fold(get(r, "marketing_consent"))),
    };
    if (rawEmail && !email) return skipped.push({ line, reason: `adresse e-mail invalide (${rawEmail.slice(0, 60)})` });
    if (!c.first_name && !c.last_name && !email && !phone) return skipped.push({ line, reason: "ligne sans nom, e-mail ni téléphone valide" });
    if (email) {
      if (seen.has(email)) return skipped.push({ line, reason: `e-mail en double dans le fichier (${email})` });
      seen.add(email);
    }
    rows.push(c);
  });
  if (table.length - 1 > CONTACT_LIMITS.importMaxRows)
    skipped.push({ line: CONTACT_LIMITS.importMaxRows + 2, reason: `au-delà de ${CONTACT_LIMITS.importMaxRows} lignes : importez le reste dans un second fichier` });
  return { rows, skipped, mapped };
}

const cell = (v: string) => (/[";\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
// Protection contre l'injection de formules dans Excel.
const safe = (v: string) => (/^[=+\-@\t\r]/.test(v) ? `'${v}` : v);

export function contactsToCsv(
  list: (ContactInput & { consent_at: string | null; consent_source: string | null; created_at: string; source: string })[],
) {
  const head = ["Prénom", "Nom", "Email", "Téléphone", "Étiquettes", "Notes", "Consentement", "Date du consentement", "Origine du consentement", "Source", "Créé le"];
  const lines = list.map((c) =>
    [
      c.first_name ?? "", c.last_name ?? "", c.email ?? "", c.phone ?? "", c.tags.join(", "), c.notes ?? "",
      c.marketing_consent ? "oui" : "non", c.consent_at ?? "", c.consent_source ?? "", c.source, c.created_at,
    ].map((v) => cell(safe(String(v)))).join(";"),
  );
  return `﻿${[head.join(";"), ...lines].join("\r\n")}\r\n`;
}
