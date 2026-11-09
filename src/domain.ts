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
// Calendar days follow the same local date convention as the morning diary.
export function painMonitor(session: Session, logs: PainLog[]) {
  return [0, 1, 2].map((offset) => {
    const date = new Date(session.started);
    date.setDate(date.getDate() + offset);
    const dateKey = day(date);
    const log = logs.find(
      (entry) =>
        entry.date === dateKey &&
        (offset !== 0 ||
          new Date(entry.at).getTime() <= new Date(session.started).getTime()),
    );
    return { date: dateKey, log };
  });
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
    ruleVersion: "0.2-manual",
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
