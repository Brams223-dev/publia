import { test } from "node:test";
import assert from "node:assert/strict";
import { contactsFromCsv, contactsToCsv, normalizePhone, normalizeTags, parseCsv } from "@/lib/contacts";

test("analyse CSV : séparateur détecté, guillemets, BOM", () => {
  assert.deepEqual(parseCsv('﻿a;b\n"x;1";"dit ""bonjour"""\r\n'), [["a", "b"], ["x;1", 'dit "bonjour"']]);
  assert.deepEqual(parseCsv("a,b\n1,2"), [["a", "b"], ["1", "2"]]);
});

test("import : colonnes françaises, consentement explicite seulement, lignes invalides signalées", () => {
  const csv = [
    "Prénom;Nom;E-mail;Téléphone;Étiquettes;Consentement",
    "Léa;Martin;LEA@exemple.fr;06 12 34 56 78;VIP, Fidèle;oui",
    "Paul;;paul@exemple.fr;;;",
    "Zoé;;pas-un-email;;;oui",
    ";;;;;",
    ";;;;06;",
    "Max;;lea@exemple.fr;;;",
  ].join("\n");
  const r = contactsFromCsv(csv);
  assert.equal(r.rows.length, 2);
  assert.deepEqual(r.rows[0], { first_name: "Léa", last_name: "Martin", email: "lea@exemple.fr", phone: "0612345678", tags: ["vip", "fidèle"], notes: null, marketing_consent: true });
  assert.equal(r.rows[1].marketing_consent, false, "colonne vide : pas de consentement");
  assert.deepEqual(r.skipped.map((s) => s.line), [4, 6, 7], "ligne vide ignorée sans erreur");
  assert.ok(r.mapped.includes("marketing_consent"));
});

test("normalisation", () => {
  assert.equal(normalizePhone("+33 (0)6 12-34-56-78"), "+330612345678");
  assert.equal(normalizePhone("12"), null);
  assert.deepEqual(normalizeTags("  VIP ,vip, Nouveau  client "), ["vip", "nouveau client"]);
});

test("export : compatible Excel et protégé contre les formules", () => {
  const out = contactsToCsv([{ first_name: "=SOMME(A1)", last_name: "Dupont; fils", email: "a@b.fr", phone: null, tags: ["vip"], notes: null, marketing_consent: true, consent_at: "2026-11-02", consent_source: "comptoir", created_at: "2026-11-02", source: "manual" }]);
  assert.ok(out.startsWith("﻿Prénom;Nom"));
  assert.ok(out.includes("'=SOMME(A1);\"Dupont; fils\";a@b.fr"));
});
