import { describe, it, expect } from "vitest";
import {
  exercises,
  newSession,
  painMonitor,
  backupSchema,
  type Session,
  type PainLog,
} from "./domain";
const doses = Object.fromEntries(
  exercises.map((e) => [e.id, { weight: e.weight, reps: e.reps }]),
);
function session(at = "2026-11-02T15:00:00.000Z"): Session {
  const s = newSession(doses, at);
  return {
    ...s,
    ended: new Date(new Date(at).getTime() + 3600e3).toISOString(),
    sets: s.sets.map((x) => ({ ...x, done: true })),
  };
}
function log(date: string, values = [2, 2, 2]): PainLog {
  return {
    id: date,
    date,
    at: `${date}T07:00:00.000Z`,
    values,
    context: "spacer",
    note: "",
  };
}
describe("Dane i serie", () => {
  it("tworzy 21 serii, po 3 na każdą stronę ćwiczenia jednonóż", () => {
    const s = newSession(doses);
    expect(s.sets).toHaveLength(21);
    expect(
      s.sets.filter((x) => x.exerciseId === "calf" && x.side === "P"),
    ).toHaveLength(3);
  });
  it("odrzuca zduplikowane serie i niepoprawną kopię", () => {
    const s = session();
    s.sets[1] = s.sets[0];
    expect(
      backupSchema.safeParse({
        version: 1,
        exportedAt: new Date().toISOString(),
        logs: [],
        sessions: [s],
      }).success,
    ).toBe(false);
  });
  it("odrzuca ból poza skalą i powtórzone dni", () => {
    const l = log("2026-11-02", [11, 2, 2]);
    expect(
      backupSchema.safeParse({
        version: 1,
        exportedAt: new Date().toISOString(),
        logs: [l],
        sessions: [],
      }).success,
    ).toBe(false);
    expect(
      backupSchema.safeParse({
        version: 1,
        exportedAt: new Date().toISOString(),
        logs: [log("2026-11-02"), { ...log("2026-11-02"), id: "inny" }],
        sessions: [],
      }).success,
    ).toBe(false);
  });
});
describe("Monitor bólu", () => {
  it("pokazuje dzień treningu i dwa kolejne poranki bez wymagania pełnych 24 i 48 h", () => {
    const logs = [
      log("2026-11-02", [0, 2, 3]),
      log("2026-11-03", [4, 5, 6]),
      log("2026-11-04", [1, 2, 3]),
    ];
    expect(painMonitor(session(), logs).map((point) => point.log)).toEqual(
      logs,
    );
  });
  it("nie zastępuje brakujących dni innymi pomiarami ani zerem", () => {
    const logs = [log("2026-11-01"), log("2026-11-02"), log("2026-11-05")];
    expect(painMonitor(session(), logs).map((point) => point.log)).toEqual([
      logs[1],
      undefined,
      undefined,
    ]);
  });
  it("nie pokazuje wpisu po rozpoczęciu treningu jako bólu przed treningiem", () => {
    const logs = [{ ...log("2026-11-02"), at: "2026-11-02T18:00:00.000Z" }];
    expect(painMonitor(session(), logs)[0].log).toBeUndefined();
  });
  it("dobiera dni na granicy miesiąca i zachowuje pomiary z różnymi kontekstami", () => {
    const logs = [
      log("2026-10-31"),
      { ...log("2026-11-01"), context: "schody" },
      log("2026-11-02"),
    ];
    expect(
      painMonitor(session("2026-10-31T15:00:00.000Z"), logs).map(
        (point) => point.log,
      ),
    ).toEqual(logs);
  });
});
