import {
  exercises,
  visibleSets,
  updatePairedSet,
  type Session,
  type SetLog,
} from "./domain";
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
                      <input
                        aria-label={`${e.name} seria ${row.index + 1} ciężar`}
                        type="number"
                        min="0"
                        max="500"
                        step="0.5"
                        value={row.weight}
                        disabled={disabled}
                        onChange={(ev) =>
                          change({ weight: Number(ev.target.value) })
                        }
                      />
                    </label>
                    <label>
                      powt.
                      <input
                        aria-label={`${e.name} seria ${row.index + 1} powtórzenia`}
                        type="number"
                        min="0"
                        max="50"
                        value={row.reps}
                        disabled={disabled}
                        onChange={(ev) =>
                          change({ reps: Number(ev.target.value) })
                        }
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
