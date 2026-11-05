import { useState, type InputHTMLAttributes } from "react";
import {
  exercises,
  visibleSets,
  updatePairedSet,
  type Session,
  type SetLog,
} from "./domain";
function SetNumberInput({
  value,
  onValueChange,
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange"> & {
  value: number;
  onValueChange: (value: number) => void;
}) {
  const [empty, setEmpty] = useState(false);
  return (
    <input
      {...props}
      value={empty && value === 0 ? "" : value}
      onChange={(event) => {
        const text = event.target.value;
        setEmpty(text === "");
        onValueChange(Number(text));
      }}
    />
  );
}

export function SessionFields({
  session,
  disabled = false,
  onChange,
}: {
  session: Session;
  disabled?: boolean;
  onChange: (next: Session) => void;
}) {
  return (
    <>
      {exercises.map((e) => (
        <section className="panel" key={e.id}>
          <h2>{e.name}</h2>
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
