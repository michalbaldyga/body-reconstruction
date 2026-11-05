import { z } from "zod";
export const sites = ["Achilles", "PHT", "Czworogłowy"];
import {
  exercises,
  exerciseCatalog,
  exerciseById,
  type Exercise,
} from "./catalog";
export {
  exercises,
  exerciseCatalog,
  exerciseById,
  type Exercise,
} from "./catalog";
export const doseSchema = z.object({
  weight: z.number().min(0).max(500),
  reps: z.number().int().min(0).max(50),
});
export type Dose = z.infer<typeof doseSchema>;
export const exerciseIdSchema = z
  .string()
  .refine(
    (id) => exerciseCatalog.some((e) => e.id === id),
    "Nieznane ćwiczenie",
  );
export const planEntrySchema = z.object({
  exerciseId: exerciseIdSchema,
  sets: z.number().int().min(1).max(10),
  weight: z.number().min(0).max(500),
  reps: z.number().int().min(0).max(50),
  note: z.string().max(1000),
});
export const planEntriesSchema = z
  .array(planEntrySchema)
  .min(1)
  .max(30)
  .refine(
    (entries) =>
      new Set(entries.map((e) => e.exerciseId)).size === entries.length,
    "Ćwiczenie może wystąpić w planie tylko raz",
  );
export const templateSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1).max(80),
  entries: planEntriesSchema,
});
export type PlanEntry = z.infer<typeof planEntrySchema>;
export type WorkoutTemplate = z.infer<typeof templateSchema>;
export function defaultTemplate(): WorkoutTemplate {
  return {
    id: "original-plan",
    name: "Plan początkowy",
    entries: exercises.map((e) => ({
      exerciseId: e.id,
      sets: 3,
      weight: e.weight,
      reps: e.reps,
      note: "",
    })),
  };
}
const painSchema = z.number().int().min(0).max(10);
export const logSchema = z.object({
  id: z.string(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  at: z.string().datetime(),
  values: z.array(painSchema).length(3),
  context: z.string().max(100),
  note: z.string().max(2000),
});
export type PainLog = z.infer<typeof logSchema>;
export const setSchema = z.object({
  exerciseId: exerciseIdSchema,
  side: z.enum(["L", "P", "both"]),
  index: z.number().int().min(0).max(9),
  weight: z.number().min(0).max(500),
  reps: z.number().int().min(0).max(50),
  done: z.boolean(),
});
export type SetLog = z.infer<typeof setSchema>;
export const sessionSchema = z
  .object({
    id: z.string(),
    started: z.string().datetime(),
    ended: z.string().datetime().optional(),
    sets: z.array(setSchema).min(1).max(600),
    plan: planEntriesSchema.optional(),
    planName: z.string().max(80).optional(),
    templateId: z.string().optional(),
    note: z.string().max(2000),
    prescribed: z
      .array(z.object({ exerciseId: z.string(), dose: doseSchema }))
      .optional(),
    decision: z.string().max(20000).optional(),
    ruleVersion: z.string().optional(),
    editedAt: z.string().datetime().optional(),
  })
  .superRefine((s, ctx) => {
    const entries = s.plan ?? defaultTemplate().entries;
    const expected = entries.flatMap((entry) => {
      const e = exerciseById(entry.exerciseId);
      if (!e) return [];
      return (e.unilateral ? ["L", "P"] : ["both"]).flatMap((side) =>
        Array.from(
          { length: entry.sets },
          (_, index) => `${e.id}/${side}/${index}`,
        ),
      );
    });
    const keys = s.sets.map((x) => `${x.exerciseId}/${x.side}/${x.index}`);
    if (
      keys.length !== expected.length ||
      new Set(keys).size !== keys.length ||
      keys.some((key) => !expected.includes(key))
    )
      ctx.addIssue({ code: "custom", message: "Nieprawidłowy zestaw serii" });
    if (s.ended && s.sets.some((x) => !x.done || x.reps < 1))
      ctx.addIssue({ code: "custom", message: "Niekompletny trening" });
    if (s.ended && s.ended < s.started)
      ctx.addIssue({
        code: "custom",
        message: "Koniec treningu jest wcześniejszy niż początek",
      });
  });
export type Session = z.infer<typeof sessionSchema>;
// Zachowujemy zapis L/P dla zgodności ze starszymi kopiami. Formularz edytuje parę naraz.
export function visibleSets(session: Session) {
  return session.sets.filter((s) => s.side !== "P");
}
export function updatePairedSet(
  session: Session,
  row: SetLog,
  patch: Partial<SetLog>,
): Session {
  return {
    ...session,
    sets: session.sets.map((s) =>
      s.exerciseId === row.exerciseId && s.index === row.index
        ? { ...s, ...patch }
        : s,
    ),
  };
}
export function completedGroups(session: Session) {
  return visibleSets(session).filter((row) =>
    session.sets
      .filter((s) => s.exerciseId === row.exerciseId && s.index === row.index)
      .every((s) => s.done),
  ).length;
}
export function validateHistoricalSession(
  raw: unknown,
  sessions: Session[],
  now = new Date(),
): Session {
  const s = sessionSchema.parse(raw);
  if (
    !s.ended ||
    new Date(s.ended).getTime() > now.getTime() ||
    new Date(s.started).getTime() > now.getTime()
  )
    throw Error(
      "Wpisz rzeczywisty początek i koniec treningu, bez dat z przyszłości.",
    );
  if (s.started >= s.ended)
    throw Error("Koniec treningu musi być późniejszy niż początek.");
  if (
    sessions.some(
      (other) =>
        other.id !== s.id &&
        new Date(s.started).getTime() <
          new Date(other.ended || now).getTime() &&
        new Date(s.ended!).getTime() > new Date(other.started).getTime(),
    )
  )
    throw Error(
      "Godziny pokrywają się z innym treningiem. Popraw datę lub godzinę.",
    );
  return s;
}
export const backupSchema = z
  .object({
    version: z.union([z.literal(1), z.literal(2)]),
    templates: z.array(templateSchema).max(200).optional(),
    exportedAt: z.string().datetime(),
    logs: z.array(logSchema).max(30000),
    sessions: z.array(sessionSchema).max(10000),
  })
  .superRefine((data, ctx) => {
    if (data.version === 2 && !data.templates)
      ctx.addIssue({ code: "custom", message: "Brak planów w kopii" });
    if (
      data.templates &&
      new Set(data.templates.map((t) => t.id)).size !== data.templates.length
    )
      ctx.addIssue({ code: "custom", message: "Powtórzone plany" });
    for (const records of [data.logs, data.sessions])
      if (new Set(records.map((x) => x.id)).size !== records.length)
        ctx.addIssue({ code: "custom", message: "Powtórzone identyfikatory" });
    if (new Set(data.logs.map((x) => x.date)).size !== data.logs.length)
      ctx.addIssue({ code: "custom", message: "Powtórzone dni" });
    if (data.sessions.filter((x) => !x.ended).length > 1)
      ctx.addIssue({
        code: "custom",
        message: "Więcej niż jeden aktywny trening",
      });
  });
export function day(at: string | Date) {
  const d = new Date(at);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function nextDay(at: string) {
  const d = new Date(at);
  d.setDate(d.getDate() + 1);
  return day(d);
}
export type Reaction = {
  kind: "stable" | "hold" | "spike" | "unknown";
  delta?: number;
  reason: string;
};
export function reaction(s: Session, logs: PainLog[], site: number): Reaction {
  const before = logs.find((l) => l.date === day(s.started)),
    after = logs.find((l) => l.date === nextDay(s.started));
  if (
    !s.ended ||
    !before ||
    !after ||
    new Date(before.at) > new Date(s.started) ||
    new Date(after.at) <= new Date(s.ended)
  )
    return {
      kind: "unknown",
      reason: "Brak pary pomiarów: rano przed i rano po sesji.",
    };
  if (!before.context || before.context !== after.context)
    return {
      kind: "unknown",
      reason: "Brak porównywalnego kontekstu pomiarów.",
    };
  const base = before.values[site],
    delta = after.values[site] - base;
  if (delta > 2)
    return {
      kind: "spike",
      delta,
      reason: `Wzrost +${delta}: sprawdź utrzymywanie się objawów ponad 24 h od sesji; wstrzymaj progresję.`,
    };
  if (delta === 2)
    return {
      kind: "hold",
      delta,
      reason:
        "Wzrost +2: utrzymanie dawki. Powtórzenie po kolejnej sesji wymaga redukcji.",
    };
  if (delta === 1 && base > 2)
    return {
      kind: "hold",
      delta,
      reason: "Wzrost +1 przy bazie ≥3: wstrzymanie progresji.",
    };
  return {
    kind: "stable",
    delta,
    reason: `Reakcja akceptowana (${delta > 0 ? "+" : ""}${delta}).`,
  };
}
export function doseOf(s: Session, e: Exercise): Dose | undefined {
  const rows = s.sets.filter((x) => x.exerciseId === e.id);
  if (
    rows.length !== (e.unilateral ? 6 : 3) ||
    rows.some((x) => !x.done || x.reps < 1)
  )
    return;
  if (rows.some((x) => x.weight !== rows[0].weight || x.reps !== rows[0].reps))
    return;
  return { weight: rows[0].weight, reps: rows[0].reps };
}
export function same(a: Dose, b: Dose) {
  return a.weight === b.weight && a.reps === b.reps;
}
export function suggest(
  e: Exercise,
  sessions: Session[],
  logs: PainLog[],
  now = new Date(),
) {
  if (!exercises.some((original) => original.id === e.id))
    return {
      status: "Ręcznie",
      reason:
        "Ustaw obciążenie i powtórzenia samodzielnie. Bez automatycznej progresji.",
      dose: undefined,
    };
  const completed = sessions
    .filter((s) => s.ended && s.sets.some((row) => row.exerciseId === e.id))
    .sort((a, b) => a.started.localeCompare(b.started));
  const last = completed.at(-1),
    dose = last ? doseOf(last, e) : { weight: e.weight, reps: e.reps };
  const hold = (reason: string, status = "Utrzymaj", next = dose) => ({
    status,
    reason,
    dose: next,
  });
  if (!dose)
    return hold(
      "Ostatni trening ma różne dawki między seriami lub nogami. Sprawdź go ręcznie.",
      "Przegląd",
    );
  if (!last)
    return hold("Plan startowy. Brak historycznych treningów i pomiarów.");
  const related = e.sites[0],
    r = reaction(last, logs, related),
    prev = completed.at(-2),
    pr = prev ? reaction(prev, logs, related) : undefined;
  if (r.kind === "spike")
    return hold(
      r.reason + " MVP wymaga ręcznej decyzji o regresji.",
      "Sprawdź reakcję",
    );
  if (r.delta === 2 && pr?.delta === 2) {
    const tolerated: Dose[] = [];
    for (let i = 1; i < completed.length - 1; i++) {
      const a = completed[i - 1],
        b = completed[i],
        ad = doseOf(a, e),
        bd = doseOf(b, e);
      if (
        ad &&
        bd &&
        same(ad, bd) &&
        reaction(a, logs, related).kind === "stable" &&
        reaction(b, logs, related).kind === "stable"
      )
        tolerated.push(bd);
    }
    const target = tolerated.reverse().find((d) => !same(d, dose));
    return target
      ? hold(
          "Dwa kolejne wzrosty +2. Proponowany powrót do historycznej tolerowanej dawki; potwierdź ocenę całego tygodnia.",
          "Cofnij dawkę",
          target,
        )
      : hold(
          "Dwa kolejne wzrosty +2. Brak potwierdzonej wcześniejszej dawki — wybierz ją ręcznie.",
          "Przegląd",
        );
  }
  if (r.kind !== "stable")
    return hold(r.reason, r.kind === "unknown" ? "Brak danych" : "Utrzymaj");
  const after = logs.find((l) => l.date === nextDay(last.started));
  const recent = logs
    .filter((l) => new Date(l.at).getTime() >= now.getTime() - 7 * 864e5)
    .sort((a, b) => a.at.localeCompare(b.at));
  if (
    recent.length >= 3 &&
    recent
      .slice(-3)
      .every(
        (l, i, arr) =>
          i === 0 || l.values[related] > arr[i - 1].values[related],
      )
  )
    return hold("Rosnący trend trzech kolejnych ocen. Nie zwiększaj dawki.");
  if (
    after &&
    recent.some(
      (l) => l.date > after.date && l.values[related] > after.values[related],
    )
  )
    return hold(
      "Nowszy wpis wskazuje pogorszenie. Sprawdź reakcję przed progresją.",
    );
  const priorDose = prev ? doseOf(prev, e) : undefined;
  const pair = !!(
    prev &&
    priorDose &&
    same(priorDose, dose) &&
    (pr?.kind === "stable" || pr?.delta === 2)
  );
  if (e.id === "calf" && dose.weight > 0 && dose.reps === 6) {
    return hold(
      "Stabilna reakcja po obciążonych wspięciach: można przejść do 8 na następnej sesji. Potwierdź brak utrzymującego się pogorszenia.",
      "Możliwa progresja",
      { ...dose, reps: 8 },
    );
  }
  if (!pair) return hold("Potrzebne dwie ocenione sesje na tej samej dawce.");
  const end = new Date(last.started),
    start = new Date(end);
  start.setDate(start.getDate() - 6);
  const dates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    return day(d);
  });
  if (dates.some((d) => !logs.some((l) => l.date === d)))
    return hold("Do oceny tygodnia brakuje codziennych wpisów.", "Brak danych");
  const week = logs
    .filter((l) => dates.includes(l.date))
    .sort((a, b) => a.date.localeCompare(b.date));
  if (week.some((l) => !l.context || l.context !== week[0].context))
    return hold(
      "Pomiary tygodnia mają różny lub nieznany kontekst. Potrzebna ręczna ocena.",
      "Przegląd",
    );
  if (after && after.values[related] > week[0].values[related] + 1)
    return hold(
      "Ból po ostatniej sesji pozostaje powyżej poziomu wyjściowego tygodnia. Potrzebna ocena utrzymującego się pogorszenia.",
    );
  if (now.getTime() - new Date(prev!.started).getTime() < 6 * 864e5)
    return hold("Zaczekaj na zakończenie tygodniowej oceny.");
  const next =
    e.id === "calf" && dose.weight === 0 && dose.reps < 8
      ? { ...dose, reps: dose.reps + 1 }
      : dose.reps < 8
        ? { ...dose, reps: 8 }
        : { weight: dose.weight + e.step, reps: 6 };
  return hold(
    "Dwie ocenione sesje i komplet wpisów. Potwierdź brak utrzymującego się pogorszenia i tolerancję przed zastosowaniem.",
    "Możliwa progresja",
    next,
  );
}
export function newSession(
  doses: Record<string, Dose>,
  at = new Date().toISOString(),
  template?: WorkoutTemplate,
): Session {
  const plan = template
    ? planEntriesSchema.parse(template.entries)
    : defaultTemplate().entries.map((e) => ({ ...e, ...doses[e.exerciseId] }));
  return {
    id: crypto.randomUUID(),
    started: at,
    note: "",
    ruleVersion: "0.1-conservative",
    ...(template
      ? {
          plan: structuredClone(plan),
          planName: template.name,
          templateId: template.id,
        }
      : {}),
    prescribed: plan.map((e) => ({
      exerciseId: e.exerciseId,
      dose: { weight: e.weight, reps: e.reps },
    })),
    sets: plan.flatMap((entry) =>
      (exerciseById(entry.exerciseId).unilateral
        ? (["L", "P"] as const)
        : (["both"] as const)
      ).flatMap((side) =>
        Array.from({ length: entry.sets }, (_, index) => ({
          exerciseId: entry.exerciseId,
          side,
          index,
          weight: entry.weight,
          reps: entry.reps,
          done: false,
        })),
      ),
    ),
  };
}
export function sessionExercises(session: Session) {
  return [...new Set(session.sets.map((s) => s.exerciseId))].map(exerciseById);
}
export function sessionPlan(session: Session): PlanEntry[] {
  return (
    session.plan ??
    sessionExercises(session).map((e) => {
      const rows = visibleSets(session).filter((s) => s.exerciseId === e.id);
      return {
        exerciseId: e.id,
        sets: rows.length,
        weight: rows[0].weight,
        reps: rows[0].reps,
        note: "",
      };
    })
  );
}
export function replaceSessionExercise(
  session: Session,
  from: string,
  to: string,
): Session {
  if (session.sets.some((s) => s.exerciseId === to))
    throw Error("To ćwiczenie jest już w treningu.");
  const plan = sessionPlan(session).map((e) =>
    e.exerciseId === from
      ? { ...e, exerciseId: to, weight: 0, reps: 0, note: "" }
      : e,
  );
  const replacement = newSession({}, session.started, {
    id: session.templateId ?? "custom",
    name: session.planName ?? "Trening",
    entries: plan,
  });
  return {
    ...session,
    plan,
    prescribed: replacement.prescribed,
    sets: plan.flatMap((entry) =>
      entry.exerciseId === to
        ? replacement.sets.filter((s) => s.exerciseId === to)
        : session.sets.filter((s) => s.exerciseId === entry.exerciseId),
    ),
  };
}
