import { test } from "node:test";
import assert from "node:assert/strict";
import { describeError, scrub } from "@/lib/observability";

test("les secrets sont masqués dans les erreurs journalisées", () => {
  const s = scrub("clé sk-proj-abcdefghijklmnop, jeton Bearer abc.def.ghijklmnop, sb_secret_ABCDEFGHIJKL et eyJhbGciOiJIUzI1.eyJzdWIiOiIxMjM0.SflKxwRJSMeKKF2QT4");
  assert.ok(!/sk-proj|abc\.def|sb_secret_A|eyJhbG/.test(s), s);
  assert.equal(s.match(/\[masqué\]/g)?.length, 4);
});

test("les messages sont tronqués et les erreurs résumées", () => {
  assert.equal(scrub("x".repeat(2000)).length, 1000);
  const e = Object.assign(new Error("boom"), { digest: "123" });
  assert.deepEqual(describeError(e), { message: "Error: boom", digest: "123", code: undefined });
  assert.deepEqual(describeError({ message: "duplicate key", code: "23505" }), { message: "duplicate key", code: "23505" });
  assert.equal(describeError("texte").message, "texte");
});
