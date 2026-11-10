import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { db, exportBackup, importBackup } from "./db";
import {
  sites,
  exerciseCatalog,
  defaultTemplate,
  templateSchema,
  sessionExercises,
  sessionPlan,
  replaceSessionExercise,
  type WorkoutTemplate,
  day,
  painMonitor,
  newSession,
  sessionSchema,
  logSchema,
  backupSchema,
  type PainLog,
  type Session,
} from "./domain";
import "./style.css";
import { SessionFields } from "./SessionFields";
import { Plans, PlanComposer } from "./Plans";
import { PainCharts } from "./PainCharts";
import { AppUpdater } from "./AppUpdater";
import { IntervalTimer } from "./IntervalTimer";
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
      updateViaCache: "none",
    })
    .catch(() => {});
const fmt = (d: string) =>
  new Date(d).toLocaleDateString("pl-PL", { day: "numeric", month: "short" });
function App() {
  const [tab, setTab] = useState("Dzisiaj"),
    [logs, setLogs] = useState<PainLog[]>([]),
    [sessions, setSessions] = useState<Session[]>([]),
    [error, setError] = useState(""),
    [ready, setReady] = useState(false),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false);
  const [date, setDate] = useState(day(new Date())),
    [time, setTime] = useState("08:00"),
    [pain, setPain] = useState(["", "", ""]),
    [context, setContext] = useState("spacer"),
    [note, setNote] = useState("");
  const [templates, setTemplates] = useState<WorkoutTemplate[]>([]);
  const [workout, setWorkout] = useState<WorkoutTemplate>(defaultTemplate);
  const [planDirty, setPlanDirty] = useState(false);
  const [historyExercise, setHistoryExercise] = useState("");
  const [editing, setEditing] = useState<Session | null>(null);
  const [editStart, setEditStart] = useState(""),
    [editEnd, setEditEnd] = useState("");
  const [editingExisting, setEditingExisting] = useState(false);
  function navigate(next: string) {
    if (next === tab) return;
    if (planDirty && !confirm("Odrzucić niezapisane zmiany planu?")) return;
    setPlanDirty(false);
    if (editing && !confirm("Odrzucić niezapisane zmiany treningu?")) return;
    setEditing(null);
    setTab(next);
    setNotice("");
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
      : {
          ...newSession({}, start.toISOString(), workout),
          ended: end.toISOString(),
        };
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
        "Trening zapisany. Historia, kalendarz i monitor bólu zostały zaktualizowane.",
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
    const savedTemplates = await db.templates.toArray();
    setTemplates(savedTemplates);
    if (!ready && savedTemplates.length)
      setWorkout(
        structuredClone(
          savedTemplates.find((t) => t.id === "original-plan") ??
            savedTemplates[0],
        ),
      );
    setReady(true);
  }
  useEffect(() => {
    refresh().catch(() =>
      setError(
        "Nie można otworzyć bazy. Sprawdź ustawienia pamięci przeglądarki.",
      ),
    );
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
          "Zastąpić wpis z tego dnia? Monitor bólu zostanie zaktualizowany.",
        )
      )
        return;
      await db.logs.put(l);
      setNotice("Pomiar zapisany na tym urządzeniu.");
    });
  }
  async function begin() {
    await action(async () => {
      const selected = templateSchema.parse(workout);
      await db.sessions.add(
        sessionSchema.parse(newSession({}, new Date().toISOString(), selected)),
      );
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
      const restored = await db.templates.toArray();
      setWorkout(structuredClone(restored[0] ?? defaultTemplate()));
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
            "Plany",
            "Zegar HSR",
            "Dane",
          ].map((t, i) => (
            <button
              key={t}
              aria-label={t}
              className={tab === t ? "selected" : ""}
              onClick={() => navigate(t)}
            >
              <span>{["◉", "↗", "＋", "▦", "◷", "☷", "◴", "◇"][i]}</span>
              {t}
            </button>
          ))}
        </nav>
        <div className="local">
          <i /> Dane na tym urządzeniu
          <small>Wersja 0.3 · bez konta i chmury</small>
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
        {!ready ? (
          <p>Otwieranie lokalnej bazy…</p>
        ) : (
          <>
            <IntervalTimer visible={tab === "Zegar HSR"} />
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
                      Twój własny plan.
                      <br />
                      Jeden krok dalej.
                    </h2>
                    <p>
                      Twój plan i monitor bólu
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
                      {hours === Infinity ? "—" : `${Math.floor(hours)} h`}
                    </strong>
                    <p>Czas od ostatniego treningu</p>
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
                    : "Sprawdź monitor bólu i ustaw dawki. Jeden wpis serii dotyczy obu nóg."}
                </p>
                {active ? (
                  <>
                    <p className="badge">
                      {active.planName ?? "Plan początkowy"} · Rozpoczęto{" "}
                      {new Date(active.started).toLocaleString("pl-PL")} ·{" "}
                      {completedGroups(active)}/{visibleSets(active).length}{" "}
                      serii
                    </p>
                    <SessionFields
                      session={active}
                      disabled={busy}
                      onChange={updateTraining}
                      onReplace={(from, to) =>
                        action(async () => {
                          if (
                            active.sets.some(
                              (row) => row.exerciseId === from && row.done,
                            ) &&
                            !confirm(
                              "Zamiana usunie wykonane serie tego ćwiczenia z bieżącego treningu. Kontynuować?",
                            )
                          )
                            return;
                          await db.sessions.put(
                            replaceSessionExercise(active, from, to),
                          );
                        })
                      }
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
                      {last
                        ? `Od ostatniego treningu minęło ${Math.floor(hours)} h.`
                        : "Brak poprzednich treningów."}
                    </div>
                    <section
                      className="panel"
                      aria-label="Monitor bólu po ostatnim treningu"
                    >
                      <h2>Monitor bólu po ostatnim treningu</h2>
                      {last ? (
                        <>
                          <p>
                            Ostatni trening: {fmt(last.started)}. Pomiary z dnia
                            treningu oraz poranków jeden i dwa dni później
                            (około 24 i 48 h).
                          </p>
                          <div className="grid three">
                            {painMonitor(last, logs).map(
                              ({ date, log }, index) => (
                                <article key={date}>
                                  <h3>
                                    {
                                      [
                                        "Przed treningiem",
                                        "Po około 24 h",
                                        "Po około 48 h",
                                      ][index]
                                    }
                                  </h3>
                                  <p>{fmt(date + "T12:00:00")}</p>
                                  {log ? (
                                    <>
                                      {sites.map((site, i) => (
                                        <p key={site}>
                                          {site}:{" "}
                                          <strong>{log.values[i]} / 10</strong>
                                        </p>
                                      ))}
                                      <p>
                                        Godzina:{" "}
                                        {new Date(log.at).toLocaleTimeString(
                                          "pl-PL",
                                          {
                                            hour: "2-digit",
                                            minute: "2-digit",
                                          },
                                        )}{" "}
                                        · Kontekst:{" "}
                                        {log.context || "Brak danych"}
                                      </p>
                                      {log.note && <p>{log.note}</p>}
                                    </>
                                  ) : (
                                    <p>Brak danych</p>
                                  )}
                                </article>
                              ),
                            )}
                          </div>
                        </>
                      ) : (
                        <p>Brak ukończonego treningu do porównania.</p>
                      )}
                      <p>
                        Samodzielnie wybierz, czy zwiększyć, zmniejszyć, czy
                        pozostawić obciążenie.
                      </p>
                    </section>
                    <section className="panel">
                      <label>
                        Szablon treningu
                        <select
                          value={
                            templates.some((t) => t.id === workout.id)
                              ? workout.id
                              : ""
                          }
                          onChange={(event) => {
                            const template = templates.find(
                              (t) => t.id === event.target.value,
                            );
                            if (
                              template &&
                              confirm(
                                "Wczytać szablon? Bieżące przygotowanie treningu zostanie zastąpione.",
                              )
                            )
                              setWorkout(structuredClone(template));
                          }}
                        >
                          <option value="" disabled>
                            Własny trening
                          </option>
                          {templates.map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <p>
                        Zmiany poniżej dotyczą tylko tego treningu. Szablony
                        edytujesz w zakładce Plany. Po zamianie ćwiczenia ustaw
                        ciężar i powtórzenia od nowa.
                      </p>
                    </section>
                    <PlanComposer
                      entries={workout.entries}
                      onChange={(entries) =>
                        setWorkout({ ...workout, entries })
                      }
                    />
                    <button
                      disabled={busy || !workout.entries.length}
                      onClick={begin}
                    >
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
                      Wpisz rzeczywiste godziny treningu. Przyszłe i nakładające
                      się treningi nie są dozwolone.
                    </p>
                  </section>
                  <SessionFields
                    session={editing}
                    disabled={busy}
                    onChange={setEditing}
                    onReplace={(from, to) => {
                      if (
                        confirm(
                          "Zastąpić ćwiczenie w tym wpisie? Jego serie trzeba będzie uzupełnić ponownie.",
                        )
                      )
                        setEditing(replaceSessionExercise(editing, from, to));
                    }}
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
                <PainCharts logs={logs} />
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
                <label>
                  Filtr ćwiczenia w historii
                  <select
                    aria-label="Filtr ćwiczenia w historii"
                    value={historyExercise}
                    onChange={(event) => setHistoryExercise(event.target.value)}
                  >
                    <option value="">Wszystkie ćwiczenia</option>
                    {exerciseCatalog
                      .filter((e) =>
                        sessions.some((s) =>
                          s.sets.some((row) => row.exerciseId === e.id),
                        ),
                      )
                      .map((e) => (
                        <option key={e.id} value={e.id}>
                          {e.name}
                        </option>
                      ))}
                  </select>
                </label>
                {historyExercise &&
                  !sessions.some((s) =>
                    s.sets.some((row) => row.exerciseId === historyExercise),
                  ) && <p>Brak treningów tego ćwiczenia.</p>}
                {[...sessions]
                  .filter(
                    (s) =>
                      !historyExercise ||
                      s.sets.some((row) => row.exerciseId === historyExercise),
                  )
                  .reverse()
                  .map((s) => (
                    <details className="panel" key={s.id}>
                      <summary>
                        {fmt(s.started)} · {s.planName ?? "Plan początkowy"} ·{" "}
                        {s.ended ? "Ukończony" : "W trakcie"} ·{" "}
                        {completedGroups(s)}/{visibleSets(s).length} serii
                      </summary>
                      {sessionExercises(s)
                        .filter(
                          (e) => !historyExercise || e.id === historyExercise,
                        )
                        .map((e) => (
                          <p key={e.id}>
                            <b>{e.name}</b>
                            <br />
                            {sessionPlan(s).find(
                              (entry) => entry.exerciseId === e.id,
                            )?.note && (
                              <span>
                                {
                                  sessionPlan(s).find(
                                    (entry) => entry.exerciseId === e.id,
                                  )?.note
                                }
                                <br />
                              </span>
                            )}
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
            {tab === "Plany" && (
              <Plans
                templates={templates}
                onDirty={setPlanDirty}
                onSave={async (template) => {
                  await db.templates.put(templateSchema.parse(template));
                  await refresh();
                }}
                onDelete={async (id) => {
                  await db.templates.delete(id);
                  await refresh();
                }}
              />
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
                    {logs.length} pomiarów · {sessions.length} treningów ·{" "}
                    {templates.length} planów
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
                <section className="panel">
                  <h2>Aktualizacja aplikacji</h2>
                  <p>
                    Sprawdź dostępność nowej wersji i odśwież aplikację.
                    Zapisane treningi i plany pozostaną na urządzeniu.
                  </p>
                  <AppUpdater disabled={busy} hasUnsavedChanges={false} />
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
