import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { describe } from "@/app/(app)/organisation/activity-labels";

test("chaque action journalisée en base a un libellé lisible", () => {
  const sql = ["20261101000013_audit_rate_limits.sql", "20261101000015_business_modules.sql"].map((f) => fs.readFileSync(`supabase/migrations/${f}`, "utf8")).join("\n");
  const actions = new Set([...sql.matchAll(/'([a-z_]+\.[a-z_]+)'/g)].map((m) => m[1]));
  for (const a of ["product.activated", "product.archived", "review.published", "review.hidden", "review.pending", "minisite.published", "minisite.unpublished"]) actions.add(a); // construites dynamiquement
  for (const a of ["product.", "review."]) actions.delete(a);
  assert.ok(actions.size >= 15, `actions trouvées : ${[...actions].join(", ")}`);
  for (const a of actions) assert.notEqual(describe({ action: a, details: {} }), a, `libellé manquant pour ${a}`);
});

test("libellés avec détails", () => {
  assert.equal(describe({ action: "member.role_changed", details: { email: "c@x.fr", from: "member", to: "admin" } }), "Rôle de c@x.fr : employé → administrateur");
  assert.equal(describe({ action: "business.updated", details: { fields: ["city", "logo_url"] } }), "Informations du commerce modifiées : ville, logo");
});
