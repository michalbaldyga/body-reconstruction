import { describe, expect, it } from "vitest";
import {
  timerDefaults,
  timerPosition,
  totalSeconds,
  validTimer,
} from "./intervalTimer";
describe("HSR timer", () => {
  it("includes preparation once and only rests between sets", () => {
    const s = { ...timerDefaults, prepare: 0 };
    expect(totalSeconds(s)).toBe(348);
    expect(totalSeconds({ ...s, prepare: 10 })).toBe(358);
    expect(timerPosition(s, 56)).toMatchObject({
      kind: "rest",
      remaining: 90,
      set: 1,
    });
    expect(timerPosition(s, 146)).toMatchObject({
      kind: "move1",
      remaining: 3,
      set: 2,
      rep: 1,
    });
    expect(timerPosition(s, 348)).toMatchObject({ kind: "done", remaining: 0 });
  });
  it("skips zero phases, preparation and rest at exact boundaries", () => {
    const s = {
      ...timerDefaults,
      prepare: 0,
      move1: 0,
      hold: 0,
      move2: 3,
      reps: 2,
      sets: 2,
      rest: 0,
    };
    expect(timerPosition(s, 0)).toMatchObject({
      kind: "move2",
      remaining: 3,
      rep: 1,
    });
    expect(timerPosition(s, 2.99)).toMatchObject({ remaining: 1, rep: 1 });
    expect(timerPosition(s, 3)).toMatchObject({ remaining: 3, rep: 2 });
    expect(timerPosition(s, 6)).toMatchObject({ set: 2, rep: 1 });
    expect(timerPosition(s, 100)).toMatchObject({ kind: "done" });
  });
  it("rejects zero-duration repetitions and invalid settings", () => {
    expect(validTimer({ ...timerDefaults, move1: 0, hold: 0, move2: 0 })).toBe(
      false,
    );
    for (const changes of [
      { reps: 0 },
      { sets: 1.5 },
      { prepare: -1 },
      { rest: NaN },
      { move1: 3601 },
    ])
      expect(validTimer({ ...timerDefaults, ...changes })).toBe(false);
  });
});
