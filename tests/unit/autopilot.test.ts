import { test } from "node:test";
import assert from "node:assert/strict";
import { localDay, zonedToUtc } from "@/lib/autopilot/time";
import { assignSlots, computeSlots } from "@/lib/autopilot/scheduler";

test("conversion Paris → UTC, y compris changements d'heure", () => {
  assert.equal(zonedToUtc("2026-11-02", "18:30").toISOString(), "2026-11-02T17:30:00.000Z");
  assert.equal(zonedToUtc("2026-07-01", "18:30").toISOString(), "2026-07-01T16:30:00.000Z");
  assert.equal(zonedToUtc("2027-03-28", "12:00").toISOString(), "2027-03-28T10:00:00.000Z");
  assert.equal(zonedToUtc("2026-10-25", "12:00").toISOString(), "2026-10-25T11:00:00.000Z");
});

test("créneaux hebdomadaires et répartition des publications", () => {
  const now = new Date("2026-11-01T18:00:00Z");
  const slots = computeSlots(
    [
      { platform: "instagram", days: [1, 3, 5], time: "18:30" },
      { platform: "facebook", days: [2, 4], time: "12:30" },
    ],
    now,
    2,
  );
  assert.equal(slots.length, 10);
  assert.equal(localDay(slots[0].at).iso, "2026-11-02");
  assert.equal(localDay(slots[0].at).time, "18:30");

  const r = assignSlots(
    [
      { id: "a", platform: "instagram", scheduled_for: "2026-11-04" },
      { id: "b", platform: "instagram", scheduled_for: "2026-11-02" },
      { id: "c", platform: "tiktok", scheduled_for: null },
      { id: "d", platform: "facebook", scheduled_for: null },
    ],
    slots,
    [slots[0].at],
  );
  const at = Object.fromEntries(r.assigned.map((x) => [x.id, `${localDay(x.at).iso} ${localDay(x.at).time}`]));
  assert.equal(at.b, "2026-11-04 18:30", "créneau déjà pris sauté");
  assert.equal(at.a, "2026-11-06 18:30", "jamais avant le jour conseillé");
  assert.equal(at.d, "2026-11-03 12:30");
  assert.ok(r.unplaced.includes("c"), "plateforme sans règle non placée");
});
