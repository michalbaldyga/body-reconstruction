import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { db, exportBackup, importBackup } from "./db";
import {
  sites,
  exercises,
  day,
  suggest,
  newSession,
  sessionSchema,
  logSchema,
  backupSchema,
  type PainLog,
  type Session,
  type Dose,
} from "./domain";
import "./style.css";
import { SessionFields, SetNumberInput } from "./SessionFields";
import { Calendar } from "./Calendar";
import {
  visibleSets,
  completedGroups,
  validateHistoricalSession,
} from "./domain";
const localDateTime = (iso: string) => {
  const d = new Date(iso);
  return day(d) + "T" + d.toTimeString().slice(0, 5);
};
if (import.meta.env.PROD && "serviceWorker" in navigator)
  navigator.serviceWorker
    .register(import.meta.env.BASE_URL + "sw.js", {
      scope: import.meta.env.BASE_URL,
    })
    .then((reg) => {
      reg.addEventListener("updatefound", () =>
        reg.installing?.addEventListener("statechange", () => {
          if (reg.waiting && navigator.serviceWorker.controller)
            window.dispatchEvent(new Event("app-update"));
        }),
      );
    })
    .catch(() => {});
const fmt = (d: string) =>
  new Date(d).toLocaleDateString("pl-PL", { day: "numeric", month: "short" });
const weight = (n: number) =>
  n === 0 ? "masa ciała" : `${n.toLocaleString("pl-PL")} kg`;
function App() {
  const [tab, setTab] = useState("Dzisiaj"),
    [logs, setLogs] = useState<PainLog[]>([]),
    [sessions, setSessions] = useState<Session[]>([]),
    [error, setError] = useState(""),
    [ready, setReady] = useState(false),
    [notice, setNotice] = useState(""),
    [update, setUpdate] = useState(false),
    [busy, setBusy] = useState(false);
  const [date, setDate] = useState(day(new Date())),
    [time, setTime] = useState("08:00"),
    [pain, setPain] = useState(["", "", ""]),
    [context, setContext] = useState("spacer"),
    [note, setNote] = useState("");
  const [draft, setDraft] = useState<Record<string, Dose>>(
    Object.fromEntries(
      exercises.map((e) => [e.id, { weight: e.weight, reps: e.reps }]),
    ),
  );
  const [editing, setEditing] = useState<Session | null>(null);
  const [editStart, setEditStart] = useState(""),
    [editEnd, setEditEnd] = useState("");
  const [editingExisting, setEditingExisting] = useState(false);
  function navigate(next: string) {
    if (editing && !confirm("Odrzucić niezapisane zmiany treningu?")) return;
    setEditing(null);
    setTab(next);
    setError("");
  }
  function openSessionEditor(session?: Session, dateValue = day(new Date())) {
    if (session && !session.ended) {
      setTab("Trening");
      return;
    }
    const end =
      dateValue === day(new Date())
        ? new Date()
        : new Date(dateValue + "T13:00:00");
    const start = new Date(end.getTime() - 3600e3);
    const initial = session
      ? structuredClone(session)
      : { ...newSession(draft, start.toISOString()), ended: end.toISOString() };
    if (!session)
      initial.sets = initial.sets.map((row) => ({ ...row, done: true }));
    setEditing(initial);
    setEditingExisting(!!session);
    setEditStart(localDateTime(initial.started));
    setEditEnd(localDateTime(initial.ended!));
    setError("");
    setNotice("");
    setTab("Edytor treningu");
  }
  async function saveHistorical(event: React.FormEvent) {
    event.preventDefault();
    await action(async () => {
      if (!editing) return;
      if (!editStart || !editEnd)
        throw Error("Uzupełnij początek i koniec treningu.");
      const saved = validateHistoricalSession(
        {
          ...editing,
          started: new Date(editStart).toISOString(),
          ended: new Date(editEnd).toISOString(),
          editedAt: new Date().toISOString(),
        },
        sessions,
      );
      await db.sessions.put(saved);
      setEditing(null);
      setTab("Historia");
      setNotice(
        "Trening zapisany. Historia, kalendarz i propozycje zostały przeliczone.",
      );
    });
  }
  async function removeSession() {
    if (!editing) return;
    await action(async () => {
      if (!confirm("Usunąć ten trening z historii?")) return;
      await db.sessions.delete(editing.id);
      setEditing(null);
      setTab("Historia");
      setNotice("Trening usunięty.");
    });
  }
  async function removePain() {
    await action(async () => {
      const current = logs.find((l) => l.date === date);
      if (current && confirm("Usunąć pomiar bólu z tego dnia?")) {
        await db.logs.delete(current.id);
        setPain(["", "", ""]);
        setNotice("Pomiar usunięty.");
      }
    });
  }
  async function refresh() {
    const stored = await db.sessions.orderBy("started").toArray();
    setLogs(await db.logs.orderBy("date").toArray());
    setSessions(stored);
    if (!ready) {
      const last = stored.filter((s) => s.ended).at(-1);
      if (last)
        setDraft(
          Object.fromEntries(
            exercises.map((e) => {
              const row = last.sets.find((x) => x.exerciseId === e.id);
              return [
                e.id,
                row
                  ? { weight: row.weight, reps: row.reps }
                  : { weight: e.weight, reps: e.reps },
              ];
            }),
          ),
        );
    }
    setReady(true);
  }
  useEffect(() => {
    refresh().catch(() =>
      setError(
        "Nie można otworzyć bazy. Sprawdź ustawienia pamięci przeglądarki.",
      ),
    );
    const handler = () => setUpdate(true);
    window.addEventListener("app-update", handler);
    return () => window.removeEventListener("app-update", handler);
  }, []);
  async function action(fn: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await fn();
      await refresh();
    } catch (e) {
      try {
        await refresh();
      } catch {
        /* Zachowaj pierwotny błąd zapisu. */
      }
      setError(
        e instanceof Error ? e.message : "Nie udało się zapisać danych.",
      );
    } finally {
      setBusy(false);
    }
  }
  const active = sessions.find((s) => !s.ended),
    last = sessions.filter((s) => s.ended).at(-1),
    today = logs.find((l) => l.date === day(new Date()));
  const hours = last
    ? (Date.now() - new Date(last.ended!).getTime()) / 36e5
    : Infinity;
  function editDate(value: string) {
    setDate(value);
    const l = logs.find((x) => x.date === value);
    setPain(l ? l.values.map(String) : ["", "", ""]);
    setContext(l?.context || "spacer");
    setNote(l?.note || "");
    if (l) setTime(new Date(l.at).toTimeString().slice(0, 5));
  }
  async function savePain(e: React.FormEvent) {
    e.preventDefault();
    await action(async () => {
      if (pain.some((x) => x === "")) throw Error("Uzupełnij trzy oceny bólu.");
      const at = new Date(`${date}T${time}:00`);
      if (at.getTime() > Date.now())
        throw Error("Nie zapisuj pomiaru z przyszłości.");
      const prior = logs.find((l) => l.date === date);
      const l = logSchema.parse({
        id: prior?.id || crypto.randomUUID(),
        date,
        at: at.toISOString(),
        values: pain.map(Number),
        context,
        note,
      });
      if (
        prior &&
        !confirm(
          "Zastąpić wpis z tego dnia? Zależne sugestie zostaną przeliczone.",
        )
      )
        return;
      await db.logs.put(l);
      setNotice("Pomiar zapisany na tym urządzeniu.");
    });
  }
  function setDose(id: string, key: keyof Dose, value: string) {
    setDraft((v) => ({ ...v, [id]: { ...v[id], [key]: Number(value) } }));
  }
  async function begin() {
    await action(async () => {
      if (hours < 72) throw Error("Od ostatniej sesji nie minęły 72 godziny.");
      const s = sessionSchema.parse({
        ...newSession(draft),
        decision: JSON.stringify({
          generatedAt: new Date().toISOString(),
          logs: logs.slice(-14),
          suggestions: exercises.map((e) => ({
            exerciseId: e.id,
            ...suggest(e, sessions, logs),
          })),
          chosen: draft,
        }),
      });
      await db.sessions.add(s);
      setTab("Trening");
    });
  }
  async function updateTraining(next: Session) {
    await action(async () => {
      const validated = sessionSchema.parse(next);
      setSessions((stored) =>
        stored.map((row) => (row.id === validated.id ? validated : row)),
      );
      await db.sessions.put(validated);
    });
  }
  async function download() {
    await action(async () => {
      const data = await exportBackup();
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
      );
      const a = document.createElement("a");
      a.href = url;
      a.download = `rehab-${day(new Date())}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      localStorage.setItem("rehab-last-backup", data.exportedAt);
      setNotice(
        "Eksport przygotowany. Sprawdź, czy plik został zapisany w Plikach / Pobranych.",
      );
    });
  }
  async function load(file: File) {
    await action(async () => {
      if (file.size > 20 * 1024 * 1024)
        throw Error("Plik jest zbyt duży (limit 20 MB).");
      const data = backupSchema.parse(JSON.parse(await file.text()));
      if (
        !confirm(
          `Plik zawiera ${data.logs.length} wpisów i ${data.sessions.length} treningów. ZASTĄPI całą lokalną bazę. Najpierw wyeksportuj obecną kopię. Kontynuować?`,
        )
      )
        return;
      await importBackup(data);
      setNotice("Kopia odtworzona.");
    });
  }
  return (
    <div className="shell">
      <aside>
        <a className="brand" href="#" onClick={(e) => e.preventDefault()}>
          <span className="brand-icon">↗</span> Body
          <br />
          <span>Reconstruction</span>
        </a>
        <p className="eyebrow">TWÓJ PROCES. TWOJE TEMPO.</p>
        <nav>
          {[
            "Dzisiaj",
            "Trening",
            "Dziennik",
            "Kalendarz",
            "Historia",
            "Plan",
            "Dane",
          ].map((t, i) => (
            <button
              key={t}
              aria-label={t}
              className={tab === t ? "selected" : ""}
              onClick={() => navigate(t)}
            >
              <span>{["◉", "↗", "＋", "▦", "◷", "☷", "◇"][i]}</span>
              {t}
            </button>
          ))}
        </nav>
        <div className="local">
          <i /> Dane na tym urządzeniu
          <small>Wersja 0.2 · bez konta i chmury</small>
        </div>
      </aside>
      <main>
        <header>
          <span>REHABILITACJA / {tab.toUpperCase()}</span>
          <span>
            {new Date().toLocaleDateString("pl-PL", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </span>
        </header>
        {error && (
          <div role="alert" className="alert">
            {error}
          </div>
        )}
        {notice && (
          <div role="status" className="notice">
            {notice}
          </div>
        )}
        {update && (
          <div className="notice">
            Dostępna aktualizacja. Zakończ trening i zamknij wszystkie okna
            aplikacji, następnie otwórz ponownie.
          </div>
        )}
        {!ready ? (
          <p>Otwieranie lokalnej bazy…</p>
        ) : (
          <>
            {tab === "Dzisiaj" && (
              <>
                <section className="heading">
                  <p className="eyebrow">MAŁE KROKI, TRWAŁY POSTĘP</p>
                  <h1>
                    Wracaj do ruchu.
                    <br />
                    <em>W swoim tempie.</em>
                  </h1>
                  <p>Zapisz reakcję. Wykonaj plan. Daj sobie czas.</p>
                </section>
                <section className="hero">
                  <div>
                    <span className="pill">TWÓJ PLAN STARTOWY</span>
                    <h2>
                      Cztery ćwiczenia.
                      <br />
                      Jeden krok dalej.
                    </h2>
                    <p>
                      2 sesje tygodniowo · minimum 72 h przerwy
                      <br />
                      {sites.join(" · ")}
                    </p>
                    <button className="light" onClick={() => setTab("Trening")}>
                      {active ? "Wznów trening" : "Przejdź do treningu"}{" "}
                      <span>↗</span>
                    </button>
                  </div>
                  <div className="hero-art" aria-hidden="true">
                    <div className="ring r1" />
                    <div className="ring r2" />
                    <div className="ring r3" />
                    <span>
                      01<span>/ PROCES</span>
                    </span>
                  </div>
                </section>
                <div className="grid three">
                  <article>
                    <p className="eyebrow">RYTM TYGODNIA</p>
                    <strong>
                      {
                        sessions.filter(
                          (s) =>
                            s.ended &&
                            Date.now() - new Date(s.ended).getTime() <
                              7 * 864e5,
                        ).length
                      }
                      <small> / 2 sesje</small>
                    </strong>
                    <p>Ukończone w ostatnich 7 dniach</p>
                  </article>
                  <article>
                    <p className="eyebrow">PORANNY CHECK-IN</p>
                    <strong>08:00</strong>
                    <p>
                      {today
                        ? "Dzisiejszy wpis zapisany"
                        : "Dziś jeszcze bez wpisu"}
                    </p>
                    <button
                      className="text-button"
                      onClick={() => {
                        editDate(day(new Date()));
                        setTab("Dziennik");
                      }}
                    >
                      {today ? "Zobacz wpis" : "Zapisz ból"} →
                    </button>
                  </article>
                  <article>
                    <p className="eyebrow">REGENERACJA</p>
                    <strong>
                      {hours === Infinity
                        ? "Gotowy"
                        : hours >= 72
                          ? "72 h ✓"
                          : `${Math.ceil(72 - hours)} h`}
                    </strong>
                    <p>
                      {hours >= 72
                        ? "Odstęp od ostatniej sesji spełniony"
                        : "Do minimalnej przerwy między sesjami"}
                    </p>
                  </article>
                </div>
                <section className="section-title">
                  <h2>Jak czują się ścięgna?</h2>
                  <button
                    className="text-button"
                    onClick={() => setTab("Dziennik")}
                  >
                    Dziennik →
                  </button>
                </section>
                <div className="grid three">
                  {sites.map((s, i) => (
                    <article key={s}>
                      <span className="site-mark">0{i + 1}</span>
                      <h3>{s}</h3>
                      <strong>
                        {today?.values[i] ?? "—"}
                        <small> / 10</small>
                      </strong>
                      <p>{today ? "Dzisiejsza ocena bólu" : "Brak pomiaru"}</p>
                    </article>
                  ))}
                </div>
                <p className="footnote">
                  Regularność jest ważniejsza od pośpiechu. Propozycje aplikacji
                  wymagają Twojego zatwierdzenia.
                </p>
              </>
            )}
            {tab === "Dziennik" && (
              <>
                <h1>Poranny check-in</h1>
                <p className="intro">
                  Raz dziennie, najlepiej o 08:00. Oceniaj osobno każdą okolicę.
                </p>
                <form onSubmit={savePain} className="panel">
                  <div className="grid two">
                    <label>
                      Dzień
                      <input
                        required
                        type="date"
                        max={day(new Date())}
                        value={date}
                        onChange={(e) => editDate(e.target.value)}
                      />
                    </label>
                    <label>
                      Godzina pomiaru
                      <input
                        required
                        type="time"
                        value={time}
                        onChange={(e) => setTime(e.target.value)}
                      />
                    </label>
                  </div>
                  {sites.map((s, i) => (
                    <label className="pain-row" key={s}>
                      <span>{s}</span>
                      <select
                        required
                        value={pain[i]}
                        onChange={(e) =>
                          setPain((v) =>
                            v.map((x, j) => (j === i ? e.target.value : x)),
                          )
                        }
                      >
                        <option value="">Wybierz 0–10</option>
                        {Array.from({ length: 11 }, (_, n) => (
                          <option key={n} value={n}>
                            {n} / 10
                          </option>
                        ))}
                      </select>
                    </label>
                  ))}
                  <label>
                    Kontekst pomiaru
                    <select
                      value={context}
                      onChange={(e) => setContext(e.target.value)}
                    >
                      <option value="spacer">Spacer</option>
                      <option value="ćwiczenie">Ćwiczenie</option>
                      <option value="spoczynek">Spoczynek</option>
                      <option value="inne">Inne</option>
                      <option value="">Nie podano</option>
                    </select>
                  </label>
                  <label>
                    Notatka (opcjonalnie)
                    <textarea
                      maxLength={2000}
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="Np. dłuższy spacer, zmiana czynności, sztywność…"
                    />
                  </label>
                  <div className="actions">
                    <button disabled={busy}>Zapisz pomiar</button>
                    {logs.some((l) => l.date === date) && (
                      <button
                        type="button"
                        className="secondary"
                        disabled={busy}
                        onClick={removePain}
                      >
                        Usuń pomiar
                      </button>
                    )}
                  </div>
                  <p className="footnote">
                    Stała godzina nie oznacza 24 godzin od treningu. Przy
                    większym skoku zapisz dodatkową informację w notatce i
                    sprawdź czas utrzymywania się reakcji.
                  </p>
                </form>
              </>
            )}
            {tab === "Trening" && (
              <>
                <h1>{active ? "Twój trening trwa" : "Następny trening"}</h1>
                <p className="intro">
                  {active
                    ? "Każda zmiana jest zapisywana na urządzeniu. Możesz zamknąć aplikację i wrócić."
                    : "Sprawdź propozycje i zatwierdź dawki. Jeden wpis serii dotyczy obu nóg."}
                </p>
                {active ? (
                  <>
                    <p className="badge">
                      Rozpoczęto{" "}
                      {new Date(active.started).toLocaleString("pl-PL")} ·{" "}
                      {completedGroups(active)}/12 serii
                    </p>
                    <SessionFields
                      session={active}
                      disabled={busy}
                      onChange={updateTraining}
                    />
                    <div className="actions">
                      <button
                        disabled={
                          busy || active.sets.some((x) => !x.done || x.reps < 1)
                        }
                        onClick={() =>
                          action(async () => {
                            await db.sessions.put(
                              sessionSchema.parse({
                                ...active,
                                ended: new Date().toISOString(),
                              }),
                            );
                            setNotice(
                              "Trening ukończony. Zapisz reakcję następnego ranka.",
                            );
                          })
                        }
                      >
                        Zakończ trening
                      </button>
                      <button
                        className="secondary"
                        disabled={busy}
                        onClick={() =>
                          action(async () => {
                            if (
                              confirm("Usunąć rozpoczęty trening i jego serie?")
                            )
                              await db.sessions.delete(active.id);
                          })
                        }
                      >
                        Odrzuć trening
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="notice">
                      {hours < 72
                        ? `Pozostało ${Math.ceil(72 - hours)} h do minimalnego odstępu.`
                        : "Minimalny odstęp spełniony. Wybieraj dwa dni w tygodniu; nie trenuj automatycznie co 72 h."}
                    </div>
                    {exercises.map((e) => {
                      const rec = suggest(e, sessions, logs);
                      return (
                        <section className="panel" key={e.id}>
                          <div className="section-title">
                            <h2>{e.name}</h2>
                            <span className="badge">{rec.status}</span>
                          </div>
                          <p>
                            {e.detail} · 3 serie{" "}
                            {e.unilateral ? "na każdą nogę" : ""}
                          </p>
                          <p className="reason">{rec.reason}</p>
                          {rec.dose && (
                            <button
                              className="text-button"
                              onClick={() => {
                                if (
                                  confirm(
                                    "Potwierdzasz tolerancję, brak utrzymującego się pogorszenia i wybór tej propozycji?",
                                  )
                                )
                                  setDraft((v) => ({
                                    ...v,
                                    [e.id]: rec.dose!,
                                  }));
                              }}
                            >
                              Zastosuj: {weight(rec.dose.weight)} · 3 ×{" "}
                              {rec.dose.reps} →
                            </button>
                          )}
                          <div className="grid two">
                            <label>
                              Ciężar {e.id === "calf" ? "dodatkowy " : ""}(kg)
                              <SetNumberInput
                                type="number"
                                min="0"
                                max="500"
                                step="0.5"
                                value={draft[e.id].weight}
                                onValueChange={(value) =>
                                  setDose(e.id, "weight", String(value))
                                }
                              />
                            </label>
                            <label>
                              Powtórzenia w serii
                              <SetNumberInput
                                type="number"
                                min="0"
                                max="50"
                                value={draft[e.id].reps}
                                onValueChange={(value) =>
                                  setDose(e.id, "reps", String(value))
                                }
                              />
                            </label>
                          </div>
                        </section>
                      );
                    })}
                    <button disabled={busy || hours < 72} onClick={begin}>
                      Zatwierdź dawki i rozpocznij
                    </button>
                    <p className="footnote">
                      MVP nie rozpoznaje urazów. Nagły silny ból lub utrata
                      funkcji wymagają oceny medycznej; nie czekaj na kolejny
                      wpis.
                    </p>
                  </>
                )}
              </>
            )}
            {tab === "Kalendarz" && (
              <Calendar
                sessions={sessions}
                logs={logs}
                onTraining={(d) => openSessionEditor(undefined, d)}
                onEdit={(s) => openSessionEditor(s)}
                onPain={(d) => {
                  editDate(d);
                  setTab("Dziennik");
                }}
              />
            )}
            {tab === "Edytor treningu" && editing && (
              <>
                <h1>
                  {editingExisting
                    ? "Edytuj trening"
                    : "Dodaj trening historyczny"}
                </h1>
                <p className="intro">
                  Wpisz faktyczne wykonanie. Dane dla lewej i prawej nogi
                  uzupełniasz wspólnie. Zmiany zostaną zapisane dopiero po
                  zatwierdzeniu.
                </p>
                <form onSubmit={saveHistorical}>
                  <section className="panel">
                    <div className="grid two">
                      <label>
                        Początek treningu
                        <input
                          type="datetime-local"
                          required
                          value={editStart}
                          onChange={(e) => setEditStart(e.target.value)}
                        />
                      </label>
                      <label>
                        Koniec treningu
                        <input
                          type="datetime-local"
                          required
                          value={editEnd}
                          onChange={(e) => setEditEnd(e.target.value)}
                        />
                      </label>
                    </div>
                    <label>
                      Notatka treningu
                      <textarea
                        maxLength={2000}
                        value={editing.note}
                        onChange={(e) =>
                          setEditing({ ...editing, note: e.target.value })
                        }
                      />
                    </label>
                    <p className="footnote">
                      Historyczne wpisy odzwierciedlają rzeczywistość: odstęp 72
                      h nie blokuje ich zapisu. Przyszłe i nakładające się
                      treningi nie są dozwolone.
                    </p>
                  </section>
                  <SessionFields
                    session={editing}
                    disabled={busy}
                    onChange={setEditing}
                  />
                  <div className="actions">
                    <button disabled={busy}>Zapisz trening</button>
                    <button
                      type="button"
                      className="secondary"
                      disabled={busy}
                      onClick={() => navigate("Historia")}
                    >
                      Anuluj
                    </button>
                    {editingExisting && (
                      <button
                        type="button"
                        className="secondary"
                        disabled={busy}
                        onClick={removeSession}
                      >
                        Usuń trening
                      </button>
                    )}
                  </div>
                </form>
              </>
            )}
            {tab === "Historia" && (
              <>
                <div className="section-title">
                  <h1>Historia procesu</h1>
                  <button onClick={() => openSessionEditor()}>
                    Dodaj trening historyczny
                  </button>
                </div>
                <p className="intro">
                  Twoje rzeczywiste wpisy. Brak pomiaru pozostaje brakiem.
                </p>
                <section className="panel">
                  <h2>Ból · ostatnie 14 wpisów</h2>
                  <div
                    className="chart"
                    role="img"
                    aria-label="Wykres bólu z ostatnich 14 wpisów"
                  >
                    {logs.slice(-14).map((l) => (
                      <div className="bar-group" key={l.id}>
                        {l.values.map((n, i) => (
                          <span
                            key={i}
                            title={`${l.date} ${sites[i]}: ${n}/10`}
                            style={{
                              height: `${Math.max(2, n * 12)}px`,
                              background: ["#285647", "#91ad6b", "#d6a06a"][i],
                            }}
                          />
                        ))}
                        <small>{l.date.slice(5)}</small>
                      </div>
                    ))}
                  </div>
                  <p className="footnote">
                    Zielony: Achilles · jasny: PHT · piaskowy: czworogłowy.
                    Odstępy oznaczają kolejne wpisy, nie upływ dni.
                  </p>
                </section>
                <h2>Pomiary</h2>
                {!logs.length && (
                  <p>
                    Jeszcze bez pomiarów. Zacznij od dzisiejszego check-inu.
                  </p>
                )}
                {[...logs].reverse().map((l) => (
                  <article className="history-row" key={l.id}>
                    <div>
                      <b>
                        {fmt(l.at)} ·{" "}
                        {new Date(l.at).toLocaleTimeString("pl-PL", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </b>
                      <p>
                        {sites
                          .map((s, i) => `${s}: ${l.values[i]}`)
                          .join(" / ")}
                      </p>
                      <small>
                        {l.context || "Bez kontekstu"} {l.note && `· ${l.note}`}
                      </small>
                    </div>
                    <button
                      className="text-button"
                      onClick={() => {
                        editDate(l.date);
                        setTab("Dziennik");
                      }}
                    >
                      Edytuj
                    </button>
                  </article>
                ))}
                <h2>Treningi</h2>
                {!sessions.length && <p>Jeszcze bez treningów.</p>}
                {[...sessions].reverse().map((s) => (
                  <details className="panel" key={s.id}>
                    <summary>
                      {fmt(s.started)} · {s.ended ? "Ukończony" : "W trakcie"} ·{" "}
                      {completedGroups(s)}/12 serii
                    </summary>
                    {exercises.map((e) => (
                      <p key={e.id}>
                        <b>{e.name}</b>
                        <br />
                        {visibleSets(s)
                          .filter((x) => x.exerciseId === e.id)
                          .map(
                            (x) =>
                              `${e.unilateral ? "L+P" : "Obunóż"} ${x.weight} kg × ${x.reps}${x.done ? " ✓" : ""}`,
                          )
                          .join(" · ")}
                      </p>
                    ))}
                    {s.note && <p>{s.note}</p>}
                    {s.editedAt && (
                      <p className="footnote">
                        Poprawiono:{" "}
                        {new Date(s.editedAt).toLocaleString("pl-PL")}
                      </p>
                    )}
                    <button
                      className="secondary"
                      onClick={() => openSessionEditor(s)}
                    >
                      {s.ended ? "Edytuj trening" : "Wznów trening"}
                    </button>
                  </details>
                ))}
              </>
            )}
            {tab === "Plan" && (
              <>
                <h1>Plan, który znasz</h1>
                <p className="intro">
                  Dwie sesje w tygodniu, minimum 72 godziny odstępu. Wszystkie
                  cztery ćwiczenia na każdej sesji.
                </p>
                {exercises.map((e) => (
                  <article key={e.id}>
                    <span className="eyebrow">{e.detail}</span>
                    <h2>{e.name}</h2>
                    <strong>
                      3 × {e.reps}
                      <small> · {weight(e.weight)}</small>
                    </strong>
                    <p>
                      {e.id === "calf"
                        ? "Najpierw +1 powtórzenie na stabilny tydzień do 8. Potem +2 kg i powrót do 6; przy stabilnej reakcji następna sesja 8."
                        : `6 → 8 powtórzeń, potem +${e.step.toLocaleString("pl-PL")} kg i powrót do 6.`}
                    </p>
                  </article>
                ))}
                <section className="panel">
                  <h2>Reguły reakcji</h2>
                  <p>
                    +1 punkt przy bazie ≤2: reakcja akceptowana. Przy bazie ≥3:
                    bez progresji.
                  </p>
                  <p>
                    +2 punkty raz: utrzymanie. Dwa kolejne wzrosty +2:
                    propozycja powrotu do ostatniej tolerowanej dawki.
                  </p>
                  <p>
                    Więcej niż +2: blokada progresji i ocena utrzymywania się
                    objawów. ≥3 punkty ponad 24 godziny: przegląd i propozycja
                    regresji, bez czekania na drugą sesję.
                  </p>
                  <p className="footnote">
                    Reguły indywidualne i ekstrapolacje, nie uniwersalny
                    protokół leczenia. Automatyczna ocena jest zachowawcza;
                    reakcja &gt;2 i złożone przypadki wymagają ręcznej decyzji.
                    PHT:{" "}
                    <a
                      href="https://doi.org/10.26603/001c.138308"
                      target="_blank"
                      rel="noreferrer"
                    >
                      protokół 2025
                    </a>
                    . Achilles:{" "}
                    <a
                      href="https://pubmed.ncbi.nlm.nih.gov/40011018/"
                      target="_blank"
                      rel="noreferrer"
                    >
                      RCT 2025
                    </a>
                    .
                  </p>
                </section>
              </>
            )}
            {tab === "Dane" && (
              <>
                <h1>Twoje dane, u Ciebie</h1>
                <p className="intro">
                  Baza jest na tym urządzeniu. Zmiana adresu aplikacji,
                  przeglądarki lub wyczyszczenie pamięci może oznaczać osobną
                  albo pustą bazę.
                </p>
                <section className="panel">
                  <h2>Kopia zapasowa</h2>
                  <p>
                    {logs.length} pomiarów · {sessions.length} treningów
                  </p>
                  <p>
                    Ostatni eksport:{" "}
                    {localStorage.getItem("rehab-last-backup")
                      ? new Date(
                          localStorage.getItem("rehab-last-backup")!,
                        ).toLocaleString("pl-PL")
                      : "jeszcze nie wykonano"}
                  </p>
                  <button disabled={busy} onClick={download}>
                    Eksportuj pełną kopię JSON
                  </button>
                  <p>
                    Zapisz pobrany plik w aplikacji Pliki. Eksport obejmuje dane
                    zdrowotne — przechowuj go prywatnie.
                  </p>
                </section>
                <section className="panel">
                  <h2>Odtwórz kopię</h2>
                  <p>
                    Import zastępuje całą bazę po sprawdzeniu pliku i
                    potwierdzeniu.
                  </p>
                  <label>
                    Wybierz plik JSON
                    <input
                      disabled={busy}
                      type="file"
                      accept=".json,application/json"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) load(f);
                        e.target.value = "";
                      }}
                    />
                  </label>
                </section>
                <section className="panel">
                  <h2>Pamięć i instalacja</h2>
                  <button
                    className="secondary"
                    onClick={() =>
                      action(async () => {
                        const granted = await navigator.storage?.persist?.();
                        setNotice(
                          granted
                            ? "Przeglądarka przyznała trwałą pamięć. Nadal wykonuj kopie."
                            : "Trwała pamięć nie została przyznana. Wykonuj regularne kopie.",
                        );
                      })
                    }
                  >
                    Poproś o trwałe przechowywanie
                  </button>
                  <p>
                    Na iPhonie: Safari → Udostępnij → Dodaj do ekranu
                    początkowego. Do instalacji i działania offline potrzebny
                    jest adres HTTPS. Szczegóły testowania znajdziesz w README
                    projektu.
                  </p>
                </section>
              </>
            )}
          </>
        )}
      </main>
      <footer>
        BODY RECONSTRUCTION <span>Konsekwencja, nie pośpiech.</span>
      </footer>
    </div>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
