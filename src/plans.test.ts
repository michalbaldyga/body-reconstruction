import { describe, it, expect } from "vitest";
import {
  defaultTemplate,
  newSession,
  visibleSets,
  sessionSchema,
  replaceSessionExercise,
  updatePairedSet,
  templateSchema,
  exerciseCatalog,
  suggest,
  exerciseById,
} from "./domain";

describe("Szablony i sesje", () => {
  it("ma pełną bazę i unikalne identyfikatory", () => {
    expect(exerciseCatalog).toHaveLength(30);
    expect(new Set(exerciseCatalog.map((e) => e.id)).size).toBe(30);
  });
  it("tworzy zmienną liczbę serii i zachowuje kopię szablonu", () => {
    const template = {
      id: "a",
      name: "Lower A",
      entries: [
        {
          exerciseId: "leg-press",
          sets: 4,
          weight: 60,
          reps: 10,
          note: "Maszyna 2",
        },
        {
          exerciseId: "clamshell",
          sets: 2,
          weight: 0,
          reps: 12,
          note: "Guma lekka",
        },
      ],
    };
    const session = newSession({}, undefined, template);
    template.entries[0].sets = 1;
    expect(visibleSets(session)).toHaveLength(6);
    expect(session.sets).toHaveLength(8);
    expect(session.plan![0].sets).toBe(4);
    expect(session.planName).toBe("Lower A");
    expect(sessionSchema.safeParse(session).success).toBe(true);
    const updated = updatePairedSet(session, visibleSets(session)[4], {
      done: true,
    });
    expect(
      updated.sets
        .filter((e) => e.exerciseId === "clamshell" && e.index === 0)
        .every((e) => e.done),
    ).toBe(true);
  });
  it("zamiana zeruje nowe ćwiczenie, zachowuje inne i nie zmienia szablonu", () => {
    const template = defaultTemplate();
    const session = newSession({}, undefined, template);
    const next = replaceSessionExercise(session, "extension", "leg-press");
    expect(next.sets.filter((s) => s.exerciseId === "leg-press")).toHaveLength(
      3,
    );
    expect(
      next.sets
        .filter((s) => s.exerciseId === "leg-press")
        .every((s) => s.weight === 0 && s.reps === 0 && !s.done),
    ).toBe(true);
    expect(next.sets.filter((s) => s.exerciseId === "calf")).toEqual(
      session.sets.filter((s) => s.exerciseId === "calf"),
    );
    expect(template.entries.at(-1)!.exerciseId).toBe("extension");
    expect(sessionSchema.safeParse(next).success).toBe(true);
    expect(() => replaceSessionExercise(next, "leg-press", "calf")).toThrow();
  });
  it("odrzuca zduplikowane ćwiczenia, brakujące serie, nieznane ćwiczenia i błędne strony", () => {
    const template = defaultTemplate();
    expect(
      templateSchema.safeParse({
        ...template,
        entries: [template.entries[0], template.entries[0]],
      }).success,
    ).toBe(false);
    const session = newSession({}, undefined, template);
    expect(
      sessionSchema.safeParse({ ...session, sets: session.sets.slice(1) })
        .success,
    ).toBe(false);
    expect(
      sessionSchema.safeParse({
        ...session,
        plan: [{ ...template.entries[0], exerciseId: "unknown" }],
      }).success,
    ).toBe(false);
    expect(
      sessionSchema.safeParse({
        ...session,
        sets: session.sets.map((s, i) =>
          i === 0 ? { ...s, side: "both" } : s,
        ),
      }).success,
    ).toBe(false);
  });
  it("nie proponuje progresji nowych ćwiczeń", () => {
    expect(suggest(exerciseById("leg-press"), [], []).dose).toBeUndefined();
  });
});
