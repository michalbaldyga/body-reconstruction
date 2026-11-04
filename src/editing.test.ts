import { describe, it, expect } from "vitest";
import {
  exercises,
  newSession,
  visibleSets,
  updatePairedSet,
  completedGroups,
  validateHistoricalSession,
  sessionSchema,
} from "./domain";
const doses = Object.fromEntries(
  exercises.map((e) => [e.id, { weight: e.weight, reps: e.reps }]),
);
function historical() {
  const s = newSession(doses, "2026-10-01T12:00:00Z");
  return {
    ...s,
    ended: "2026-10-01T13:00:00Z",
    sets: s.sets.map((row) => ({ ...row, done: true })),
  };
}
describe("Wspólne serie i edycja historii", () => {
  it("pokazuje 12 wierszy i zmienia obie nogi w jednej serii bez zmiany innych serii", () => {
    const s = newSession(doses);
    expect(visibleSets(s)).toHaveLength(12);
    const next = updatePairedSet(s, visibleSets(s)[0], { reps: 5, done: true });
    expect(
      next.sets
        .filter((r) => r.exerciseId === "calf" && r.index === 0)
        .map((r) => r.reps),
    ).toEqual([5, 5]);
    expect(
      next.sets
        .filter((r) => r.exerciseId === "calf" && r.index === 1)
        .map((r) => r.reps),
    ).toEqual([4, 4]);
    expect(completedGroups(next)).toBe(1);
    expect(sessionSchema.safeParse(next).success).toBe(true);
  });
  it("akceptuje starszy format i zachowuje różne dawki, dopóki nie zostaną poprawione", () => {
    const s = historical();
    s.sets[3].reps = 7;
    const parsed = sessionSchema.parse(s);
    expect(parsed.sets[0].reps).toBe(4);
    expect(parsed.sets[3].reps).toBe(7);
  });
  it("zapisuje przeszły trening i dopuszcza poprawienie tego samego rekordu", () => {
    const s = historical();
    expect(validateHistoricalSession({ ...s, note: "korekta" }, [s]).note).toBe(
      "korekta",
    );
  });
  it("odrzuca daty przyszłe, odwrócone godziny i nakładanie treningów", () => {
    const s = historical();
    expect(() =>
      validateHistoricalSession(s, [], new Date("2026-09-01")),
    ).toThrow();
    expect(() =>
      validateHistoricalSession({ ...s, ended: s.started }, []),
    ).toThrow();
    expect(() => validateHistoricalSession({ ...s, id: "other" }, [s])).toThrow(
      /pokrywają/,
    );
  });
});
