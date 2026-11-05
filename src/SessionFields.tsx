import { ExercisePicker } from "./Plans";
import { SetNumberInput } from "./SetNumberInput";
import {
  sessionExercises,
  sessionPlan,
  visibleSets,
  updatePairedSet,
  type Session,
  type SetLog,
} from "./domain";
export function SessionFields({
  session,
  disabled = false,
  onChange,
  onReplace,
}: {
  session: Session;
  disabled?: boolean;
  onChange: (next: Session) => void;
  onReplace?: (from: string, to: string) => void;
}) {
  return (
    <>
      {sessionExercises(session).map((e) => (
        <section className="panel" key={e.id}>
          <h2>{e.name}</h2>
          {sessionPlan(session).find((entry) => entry.exerciseId === e.id)
            ?.note && (
            <p className="reason">
              {
                sessionPlan(session).find((entry) => entry.exerciseId === e.id)
                  ?.note
              }
            </p>
          )}
          {onReplace && !disabled && (
            <ExercisePicker
              label={`Zamień: ${e.name}`}
              excluded={sessionExercises(session).map((e) => e.id)}
              onPick={(id) => onReplace(e.id, id)}
            />
          )}
          <p>
            {e.detail}
            {e.unilateral ? " · jeden wpis dotyczy obu nóg" : ""}
          </p>
          {visibleSets(session)
            .filter((s) => s.exerciseId === e.id)
            .map((row) => {
              const pair = session.sets.filter(
                (s) => s.exerciseId === row.exerciseId && s.index === row.index,
              );
              const differs = pair.some(
                (s) =>
                  s.reps !== row.reps ||
                  s.weight !== row.weight ||
                  s.done !== row.done,
              );
              const change = (patch: Partial<SetLog>) =>
                onChange(updatePairedSet(session, row, patch));
              return (
                <div key={row.index}>
                  {differs && (
                    <p className="notice">
                      Stary zapis ma różne wartości dla nóg:{" "}
                      {pair
                        .map((s) => `${s.side}: ${s.weight} kg × ${s.reps}`)
                        .join(" / ")}
                      . Zmiana pola zastosuje je do obu nóg.
                    </p>
                  )}
                  <div
                    className={
                      "set-row " + (pair.every((s) => s.done) ? "done" : "")
                    }
                  >
                    <label>
                      <input
                        type="checkbox"
                        aria-label={`${e.name} seria ${row.index + 1} wykonana`}
                        checked={pair.every((s) => s.done)}
                        disabled={disabled}
                        onChange={(ev) => change({ done: ev.target.checked })}
                      />
                      Seria {row.index + 1}
                      {e.unilateral ? " · L+P" : ""}
                    </label>
                    <label>
                      kg
                      <SetNumberInput
                        aria-label={`${e.name} seria ${row.index + 1} ciężar`}
                        type="number"
                        min="0"
                        max="500"
                        step="0.5"
                        value={row.weight}
                        disabled={disabled}
                        onValueChange={(weight) => change({ weight })}
                      />
                    </label>
                    <label>
                      powt.
                      <SetNumberInput
                        aria-label={`${e.name} seria ${row.index + 1} powtórzenia`}
                        type="number"
                        min="0"
                        max="50"
                        value={row.reps}
                        disabled={disabled}
                        onValueChange={(reps) => change({ reps })}
                      />
                    </label>
                  </div>
                </div>
              );
            })}
        </section>
      ))}
    </>
  );
}
