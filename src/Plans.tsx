import { useState, useEffect } from "react";
import {
  exerciseCatalog,
  exerciseById,
  defaultTemplate,
  templateSchema,
  type PlanEntry,
  type WorkoutTemplate,
} from "./domain";
import { SetNumberInput } from "./SetNumberInput";

export function ExercisePicker({
  excluded,
  onPick,
  label = "Dodaj ćwiczenie",
}: {
  excluded: string[];
  onPick: (id: string) => void;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [equipment, setEquipment] = useState("");
  const normalize = (s: string) =>
    s
      .toLocaleLowerCase("pl")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replaceAll("ł", "l");
  const results = exerciseCatalog.filter(
    (e) =>
      !excluded.includes(e.id) &&
      (!equipment || e.equipment === equipment) &&
      normalize(e.name + " " + e.detail + " " + e.id).includes(
        normalize(query),
      ),
  );
  return (
    <div className="exercise-picker">
      <button
        type="button"
        className="secondary"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        {label}
      </button>
      {open && (
        <section className="exercise-library" aria-label="Baza ćwiczeń">
          <div className="grid two">
            <label>
              Szukaj ćwiczenia
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>
            <label>
              Sprzęt
              <select
                aria-label="Sprzęt"
                value={equipment}
                onChange={(e) => setEquipment(e.target.value)}
              >
                <option value="">Wszystkie</option>
                {[...new Set(exerciseCatalog.map((e) => e.equipment))].map(
                  (value) => (
                    <option key={value}>{value}</option>
                  ),
                )}
              </select>
            </label>
          </div>
          <p>{results.length} ćwiczeń do wyboru</p>
          <div className="exercise-results">
            {results.map((e) => (
              <button
                type="button"
                className="exercise-option secondary"
                key={e.id}
                onClick={() => {
                  onPick(e.id);
                  setOpen(false);
                }}
              >
                <strong>{e.name}</strong>
                <span>
                  {e.equipment} · {e.detail}
                </span>
              </button>
            ))}
          </div>
          {!results.length && <p>Brak pasujących ćwiczeń.</p>}
        </section>
      )}
    </div>
  );
}

export function PlanComposer({
  entries,
  onChange,
}: {
  entries: PlanEntry[];
  onChange: (entries: PlanEntry[]) => void;
}) {
  function update(index: number, patch: Partial<PlanEntry>) {
    onChange(entries.map((e, i) => (i === index ? { ...e, ...patch } : e)));
  }
  function move(index: number, delta: number) {
    const next = [...entries];
    [next[index], next[index + delta]] = [next[index + delta], next[index]];
    onChange(next);
  }
  return (
    <>
      {entries.map((entry, index) => {
        const exercise = exerciseById(entry.exerciseId);
        return (
          <section
            className="panel"
            key={entry.exerciseId}
            aria-label={`Ustawienia: ${exercise.name}`}
          >
            <h2>{exercise.name}</h2>
            <p>{exercise.detail}</p>
            <div className="actions plan-actions">
              <button
                type="button"
                className="secondary"
                aria-label={`Przesuń w górę: ${exercise.name}`}
                disabled={index === 0}
                onClick={() => move(index, -1)}
              >
                ↑
              </button>
              <button
                type="button"
                className="secondary"
                aria-label={`Przesuń w dół: ${exercise.name}`}
                disabled={index === entries.length - 1}
                onClick={() => move(index, 1)}
              >
                ↓
              </button>
              <ExercisePicker
                label={`Zamień: ${exercise.name}`}
                excluded={entries.map((e) => e.exerciseId)}
                onPick={(exerciseId) =>
                  update(index, { exerciseId, weight: 0, reps: 0, note: "" })
                }
              />
              <button
                type="button"
                className="text-button"
                onClick={() => onChange(entries.filter((_, i) => i !== index))}
              >
                Usuń: {exercise.name}
              </button>
            </div>
            <div className="grid three plan-numbers">
              <label>
                Liczba serii
                <select
                  aria-label="Liczba serii"
                  value={entry.sets}
                  onChange={(event) =>
                    update(index, { sets: Number(event.target.value) })
                  }
                >
                  {Array.from({ length: 10 }, (_, i) => (
                    <option key={i + 1} value={i + 1}>
                      {i + 1}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Ciężar {exercise.id === "calf" ? "dodatkowy " : ""}(kg)
                <SetNumberInput
                  type="number"
                  min={0}
                  max={500}
                  step="0.5"
                  value={entry.weight}
                  onValueChange={(weight) => update(index, { weight })}
                />
              </label>
              <label>
                Powtórzenia w serii{exercise.unilateral ? " (na stronę)" : ""}
                <SetNumberInput
                  type="number"
                  min={0}
                  max={50}
                  value={entry.reps}
                  onValueChange={(reps) => update(index, { reps })}
                />
              </label>
            </div>
            <label>
              Notatka do ćwiczenia: {exercise.name}
              <input
                maxLength={1000}
                placeholder={
                  exercise.equipment === "Guma"
                    ? "Np. kolor i opór gumy"
                    : "Wskazówki, sprzęt, ustawienie maszyny"
                }
                value={entry.note}
                onChange={(e) => update(index, { note: e.target.value })}
              />
            </label>
          </section>
        );
      })}
      {!entries.length && <p>Wybierz ćwiczenia z bazy, aby zbudować plan.</p>}
      {entries.length < 30 && (
        <ExercisePicker
          excluded={entries.map((e) => e.exerciseId)}
          onPick={(id) => {
            const e = exerciseById(id);
            onChange([
              ...entries,
              { exerciseId: id, sets: 3, weight: 0, reps: e.reps, note: "" },
            ]);
          }}
        />
      )}
    </>
  );
}

export function Plans({
  templates,
  onSave,
  onDelete,
  onDirty,
}: {
  onDirty: (dirty: boolean) => void;
  templates: WorkoutTemplate[];
  onSave: (template: WorkoutTemplate) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState<WorkoutTemplate | null>(null);
  useEffect(() => {
    onDirty(!!editing);
    return () => onDirty(false);
  }, [editing, onDirty]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  async function save(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setSaving(true);
    try {
      await onSave(templateSchema.parse(editing));
      setEditing(null);
      setMessage("Plan zapisany.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Nie udało się zapisać planu.");
    } finally {
      setSaving(false);
    }
  }
  return (
    <>
      <h1>Twoje plany</h1>
      <p className="intro">
        Utwórz Lower A, Lower B lub własny zestaw. Zmiany szablonu nie zmieniają
        zapisanych treningów. Nowe ćwiczenia mają ręcznie ustalane obciążenia.
      </p>
      {error && (
        <div role="alert" className="alert">
          {error}
        </div>
      )}
      {message && (
        <p role="status" className="notice">
          {message}
        </p>
      )}
      {!editing ? (
        <>
          <button
            onClick={() => {
              setEditing({ id: crypto.randomUUID(), name: "", entries: [] });
              setMessage("");
              setError("");
            }}
          >
            Nowy plan
          </button>
          <div className="template-list">
            {templates.map((t) => (
              <article key={t.id}>
                <h2>{t.name}</h2>
                <p>
                  {t.entries
                    .map((e) => exerciseById(e.exerciseId).name)
                    .join(" · ")}
                </p>
                <p>
                  {t.entries.reduce((sum, e) => sum + e.sets, 0)} serii ·{" "}
                  {t.entries.length} ćwiczeń
                </p>
                <div className="actions">
                  <button
                    className="secondary"
                    onClick={() => {
                      setEditing(structuredClone(t));
                      setMessage("");
                      setError("");
                    }}
                  >
                    Edytuj: {t.name}
                  </button>
                  <button
                    className="secondary"
                    onClick={() => {
                      setEditing({
                        ...structuredClone(t),
                        id: crypto.randomUUID(),
                        name: t.name + " — kopia",
                      });
                      setMessage("");
                    }}
                  >
                    Kopiuj: {t.name}
                  </button>
                  <button
                    className="text-button"
                    onClick={async () => {
                      if (
                        !confirm(
                          `Usunąć plan „${t.name}”? Historia treningów zostanie zachowana.`,
                        )
                      )
                        return;
                      try {
                        await onDelete(t.id);
                        setMessage(
                          "Plan usunięty. Historia pozostaje bez zmian.",
                        );
                      } catch {
                        setError("Nie udało się usunąć planu.");
                      }
                    }}
                  >
                    Usuń plan: {t.name}
                  </button>
                </div>
              </article>
            ))}
          </div>
          {!templates.length && (
            <p>
              Nie masz jeszcze szablonów. Utwórz pierwszy plan lub skopiuj plan
              początkowy.
            </p>
          )}
          <button
            className="secondary"
            onClick={() =>
              setEditing({ ...defaultTemplate(), id: crypto.randomUUID() })
            }
          >
            Utwórz z planu początkowego
          </button>
        </>
      ) : (
        <form onSubmit={save}>
          <label>
            Nazwa planu
            <input
              required
              maxLength={80}
              value={editing.name}
              onChange={(e) => setEditing({ ...editing, name: e.target.value })}
              placeholder="Np. Lower A"
            />
          </label>
          <fieldset disabled={saving} className="plan-fieldset">
            <PlanComposer
              entries={editing.entries}
              onChange={(entries) => setEditing({ ...editing, entries })}
            />
          </fieldset>
          <div className="actions">
            <button disabled={saving || !editing.entries.length}>
              Zapisz plan
            </button>
            <button
              type="button"
              className="secondary"
              disabled={saving}
              onClick={() => {
                if (confirm("Odrzucić niezapisane zmiany planu?")) {
                  setEditing(null);
                  setError("");
                }
              }}
            >
              Anuluj edycję planu
            </button>
          </div>
        </form>
      )}
    </>
  );
}
