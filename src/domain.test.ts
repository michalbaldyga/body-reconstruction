import { describe, it, expect } from "vitest";
import {
  exercises,
  newSession,
  reaction,
  suggest,
  backupSchema,
  day,
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
describe("Reakcja bólu", () => {
  it("akceptuje 2 → 3, ale nie 3 → 4", () => {
    const s = session();
    expect(
      reaction(s, [log("2026-11-02"), log("2026-11-03", [3, 2, 2])], 0).kind,
    ).toBe("stable");
    expect(
      reaction(
        s,
        [log("2026-11-02", [3, 2, 2]), log("2026-11-03", [4, 2, 2])],
        0,
      ).kind,
    ).toBe("hold");
  });
  it("wstrzymuje przy +2 i osobno klasyfikuje >2", () => {
    expect(
      reaction(session(), [log("2026-11-02"), log("2026-11-03", [4, 2, 2])], 0)
        .kind,
    ).toBe("hold");
    expect(
      reaction(session(), [log("2026-11-02"), log("2026-11-03", [5, 2, 2])], 0)
        .kind,
    ).toBe("spike");
  });
  it("nie zastępuje braków zerem ani nie porównuje różnych czynności", () => {
    expect(reaction(session(), [], 0).kind).toBe("unknown");
    expect(
      reaction(
        session(),
        [log("2026-11-02"), { ...log("2026-11-03"), context: "ćwiczenie" }],
        0,
      ).kind,
    ).toBe("unknown");
  });
  it("nie traktuje pomiaru po rozpoczęciu jako bazowego", () => {
    expect(
      reaction(
        session(),
        [
          { ...log("2026-11-02"), at: "2026-11-02T18:00:00.000Z" },
          log("2026-11-03"),
        ],
        0,
      ).kind,
    ).toBe("unknown");
  });
});
describe("Propozycje", () => {
  it("akceptuje parę +2 potem 0 po powrocie do poziomu wyjściowego", () => {
    const a = session("2026-10-30T15:00:00.000Z"),
      b = session();
    const logs = Array.from({ length: 8 }, (_, i) => {
      const d = new Date("2026-10-27T07:00:00Z");
      d.setDate(d.getDate() + i);
      return log(day(d), day(d) === "2026-10-31" ? [4, 2, 2] : [2, 2, 2]);
    });
    const result = suggest(
      exercises[0],
      [a, b],
      logs,
      new Date("2026-11-06T10:00:00Z"),
    );
    expect(result.status).toBe("Możliwa progresja");
    expect(result.dose).toEqual({ weight: 0, reps: 5 });
  });
  it("nie zwiększa dawki bez danych", () => {
    expect(suggest(exercises[1], [], []).dose).toEqual({ weight: 0, reps: 6 });
    expect(suggest(exercises[1], [session()], []).status).toBe("Brak danych");
  });
  it("nie zwiększa przy dwóch kolejnych +2 i braku tolerowanej historii", () => {
    const a = session(),
      b = session("2026-11-05T15:00:00.000Z");
    const logs = [
      log("2026-11-02"),
      log("2026-11-03", [4, 2, 2]),
      log("2026-11-05"),
      log("2026-11-06", [4, 2, 2]),
    ];
    expect(suggest(exercises[0], [a, b], logs).status).toBe("Przegląd");
  });
  it("obciążone wspięcia 6 → 8 po jednej stabilnej sesji", () => {
    const s = session();
    s.sets = s.sets.map((x) =>
      x.exerciseId === "calf" ? { ...x, weight: 2, reps: 6 } : x,
    );
    expect(
      suggest(
        exercises[0],
        [s],
        [log("2026-11-02"), log("2026-11-03")],
        new Date("2026-11-04T10:00:00Z"),
      ).dose,
    ).toEqual({ weight: 2, reps: 8 });
  });
  it("RDL zwiększa o 2,5 kg, curl o 1 kg", () => {
    const a = session("2026-10-30T15:00:00.000Z"),
      b = session();
    for (const s of [a, b])
      s.sets = s.sets.map((x) =>
        x.exerciseId === "rdl" ? { ...x, reps: 8 } : x,
      );
    const logs = Array.from({ length: 8 }, (_, i) => {
      const d = new Date("2026-10-27T07:00:00Z");
      d.setDate(d.getDate() + i);
      return log(day(d));
    });
    expect(
      suggest(exercises[1], [a, b], logs, new Date("2026-11-06T10:00:00Z"))
        .dose,
    ).toEqual({ weight: 2.5, reps: 6 });
    expect(
      suggest(exercises[2], [a, b], logs, new Date("2026-11-06T10:00:00Z"))
        .dose,
    ).toEqual({ weight: 1, reps: 6 });
  });
  it("nie progresuje gdy nowszy wpis wskazuje pogorszenie", () => {
    const s = session();
    s.sets = s.sets.map((x) =>
      x.exerciseId === "calf" ? { ...x, weight: 2, reps: 6 } : x,
    );
    const result = suggest(
      exercises[0],
      [s],
      [log("2026-11-02"), log("2026-11-03"), log("2026-11-04", [5, 2, 2])],
      new Date("2026-11-04T10:00:00Z"),
    );
    expect(result.status).toBe("Utrzymaj");
  });
});
