export type TimerSettings = {
  prepare: number;
  move1: number;
  hold: number;
  move2: number;
  reps: number;
  sets: number;
  rest: number;
  sound: boolean;
};
export const timerDefaults: TimerSettings = {
  prepare: 5,
  move1: 3,
  hold: 1,
  move2: 3,
  reps: 8,
  sets: 3,
  rest: 90,
  sound: true,
};
export const timerFields = [
  ["prepare", "Czas przygotowania", 0, 3600],
  ["move1", "Ruch 1", 0, 3600],
  ["hold", "Zatrzymanie", 0, 3600],
  ["move2", "Ruch 2", 0, 3600],
  ["reps", "Powtórzenia w serii", 1, 100],
  ["sets", "Liczba serii", 1, 100],
  ["rest", "Przerwa między seriami", 0, 3600],
] as const;
export function validTimer(s: TimerSettings) {
  return (
    timerFields.every(
      ([key, , min, max]) =>
        Number.isInteger(s[key]) && s[key] >= min && s[key] <= max,
    ) &&
    s.move1 + s.hold + s.move2 > 0 &&
    typeof s.sound === "boolean"
  );
}
export function totalSeconds(s: TimerSettings) {
  return (
    s.prepare +
    (s.move1 + s.hold + s.move2) * s.reps * s.sets +
    s.rest * (s.sets - 1)
  );
}
export function timerPosition(s: TimerSettings, elapsed: number) {
  const total = totalSeconds(s);
  let t = Math.max(0, elapsed);
  if (t >= total)
    return {
      phase: "Koniec",
      kind: "done",
      remaining: 0,
      set: s.sets,
      rep: s.reps,
    };
  if (t < s.prepare)
    return {
      phase: "Przygotowanie",
      kind: "prepare",
      remaining: Math.ceil(s.prepare - t),
      set: 1,
      rep: 1,
    };
  t -= s.prepare;
  const repTime = s.move1 + s.hold + s.move2;
  const blockTime = repTime * s.reps + s.rest;
  const set = Math.floor(t / blockTime) + 1;
  t %= blockTime;
  if (t >= repTime * s.reps)
    return {
      phase: "Przerwa",
      kind: "rest",
      remaining: Math.ceil(blockTime - t),
      set,
      rep: s.reps,
    };
  const rep = Math.floor(t / repTime) + 1;
  t %= repTime;
  for (const [phase, kind, duration] of [
    ["Ruch 1", "move1", s.move1],
    ["Zatrzymanie", "hold", s.hold],
    ["Ruch 2", "move2", s.move2],
  ] as const) {
    if (t < duration)
      return { phase, kind, remaining: Math.ceil(duration - t), set, rep };
    t -= duration;
  }
  throw new Error("Nieprawidłowy czas zegara");
}
export function formatTimer(seconds: number) {
  return `${Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0")}:${Math.ceil(seconds % 60)
    .toString()
    .padStart(2, "0")}`;
}
