import { useEffect, useRef, useState } from "react";
import {
  formatTimer,
  timerDefaults,
  timerFields,
  timerPosition,
  totalSeconds,
  validTimer,
  type TimerSettings,
} from "./intervalTimer";
const storageKey = "body-reconstruction-hsr-timer-v1";
function loadSettings(): TimerSettings {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || "null");
    if (saved && validTimer(saved)) return saved;
  } catch {
    /* Use defaults if storage is unavailable or corrupt. */
  }
  return { ...timerDefaults };
}
export function IntervalTimer({ visible }: { visible: boolean }) {
  const [settings, setSettings] = useState(loadSettings);
  const [status, setStatus] = useState<"idle" | "running" | "paused" | "done">(
    "idle",
  );
  const [elapsed, setElapsed] = useState(0);
  const [message, setMessage] = useState("");
  const anchor = useRef(0),
    offset = useRef(0),
    lastBeat = useRef(-1);
  const audio = useRef<AudioContext | null>(null);
  const total = totalSeconds(settings);
  const position = validTimer(settings)
    ? timerPosition(settings, elapsed)
    : null;
  const active = status === "running" || status === "paused";
  useEffect(() => {
    if (!validTimer(settings)) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(settings));
    } catch {
      setMessage("Nie można zapamiętać ustawień w tej przeglądarce.");
    }
  }, [settings]);
  function beep(finish = false) {
    const ctx = audio.current;
    if (!settings.sound || !ctx || ctx.state !== "running") return;
    const oscillator = ctx.createOscillator(),
      gain = ctx.createGain();
    oscillator.frequency.value = finish ? 880 : 660;
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.16, ctx.currentTime + 0.005);
    gain.gain.exponentialRampToValueAtTime(
      0.001,
      ctx.currentTime + (finish ? 0.4 : 0.08),
    );
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.start();
    oscillator.stop(ctx.currentTime + (finish ? 0.45 : 0.1));
    oscillator.onended = () => {
      oscillator.disconnect();
      gain.disconnect();
    };
  }
  function enableAudio() {
    if (!settings.sound) return;
    try {
      audio.current ??= new AudioContext();
      void audio.current
        .resume()
        .then(() => {
          if (audio.current?.state !== "running")
            setMessage(
              "Dźwięk jest niedostępny. Sprawdź ustawienia przeglądarki.",
            );
        })
        .catch(() =>
          setMessage("Nie udało się uruchomić dźwięku. Zegar działa dalej."),
        );
    } catch {
      setMessage(
        "Ta przeglądarka nie obsługuje piknięć. Zegar działa bez dźwięku.",
      );
    }
  }
  useEffect(() => {
    if (status !== "running") return;
    const update = () => {
      const next = Math.min(
        total,
        offset.current + (performance.now() - anchor.current) / 1000,
      );
      setElapsed(next);
      const beat = Math.floor(next);
      if (beat !== lastBeat.current) {
        lastBeat.current = beat;
        beep(next >= total);
      }
      if (next >= total) setStatus("done");
    };
    update();
    const id = window.setInterval(update, 40);
    return () => window.clearInterval(id);
  }, [status, settings, total]);
  useEffect(() => {
    if (status !== "running" || !("wakeLock" in navigator)) return;
    let cancelled = false;
    let lock: WakeLockSentinel | undefined;
    async function acquire() {
      if (document.visibilityState !== "visible" || (lock && !lock.released))
        return;
      try {
        const next = await navigator.wakeLock.request("screen");
        if (cancelled) await next.release();
        else lock = next;
      } catch {
        /* Screen lock is best effort. */
      }
    }
    void acquire();
    document.addEventListener("visibilitychange", acquire);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", acquire);
      void lock?.release().catch(() => {});
    };
  }, [status]);
  useEffect(() => {
    if (!active) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [active]);
  useEffect(
    () => () => {
      void audio.current?.close().catch(() => {});
    },
    [],
  );
  function start() {
    setMessage("");
    enableAudio();
    offset.current = 0;
    anchor.current = performance.now();
    lastBeat.current = 0;
    setElapsed(0);
    setStatus("running");
  }
  function pause() {
    offset.current = Math.min(
      total,
      offset.current + (performance.now() - anchor.current) / 1000,
    );
    setElapsed(offset.current);
    setStatus(offset.current >= total ? "done" : "paused");
  }
  if (!visible) return null;
  return (
    <section className="hsr-timer">
      <div className="heading">
        <p className="eyebrow">TWÓJ RYTM ĆWICZENIA</p>
        <h1>Zegar HSR</h1>
        <p>Ruch 1 → zatrzymanie → ruch 2. Ty wybierasz kierunek ruchu.</p>
      </div>
      {message && (
        <p role="status" className="notice">
          {message}
        </p>
      )}
      {active || status === "done" ? (
        <div className={`panel timer-display timer-${position?.kind}`}>
          <p className="eyebrow" role="status">
            {status === "paused"
              ? "PAUZA"
              : status === "done"
                ? "UKOŃCZONO"
                : "W TOKU"}
          </p>
          <h2 aria-live="polite">{position?.phase}</h2>
          <div
            className="timer-clock"
            role="timer"
            aria-label="Pozostały czas fazy"
          >
            {formatTimer(position?.remaining ?? 0)}
          </div>
          <div className="timer-counts">
            <span>
              Powtórzenie{" "}
              <b>
                {position?.rep}/{settings.reps}
              </b>
            </span>
            <span>
              Seria{" "}
              <b>
                {position?.set}/{settings.sets}
              </b>
            </span>
          </div>
          <progress aria-label="Postęp zegara" max={total} value={elapsed} />
          <p>
            Do końca: {formatTimer(Math.ceil(total - elapsed))}
            {position?.kind === "rest"
              ? ` · Następna seria: ${(position?.set ?? 0) + 1}`
              : ""}
          </p>
          <div className="actions">
            {status === "running" && <button onClick={pause}>Pauza</button>}
            {status === "paused" && (
              <button
                onClick={() => {
                  enableAudio();
                  anchor.current = performance.now();
                  setStatus("running");
                }}
              >
                Wznów
              </button>
            )}
            {active && (
              <button
                className="secondary"
                onClick={() => {
                  if (confirm("Zakończyć odliczanie?")) {
                    setStatus("idle");
                    setElapsed(0);
                  }
                }}
              >
                Zakończ
              </button>
            )}
            {status === "done" && (
              <>
                <button onClick={start}>Uruchom ponownie</button>
                <button
                  className="secondary"
                  onClick={() => {
                    setStatus("idle");
                    setElapsed(0);
                  }}
                >
                  Zmień ustawienia
                </button>
              </>
            )}
          </div>
        </div>
      ) : (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (validTimer(settings)) start();
          }}
        >
          <div className="panel">
            <h2>Ustawienia zegara</h2>
            <p>
              Czasy w sekundach. Wpisz 0, żeby pominąć fazę, przygotowanie lub
              przerwę.
            </p>
            <div className="timer-settings">
              {timerFields.map(([key, label, min, max]) => (
                <label className={`timer-field timer-${key}`} key={key}>
                  <span>
                    {label}
                    <small>
                      {key === "reps" || key === "sets" ? "liczba" : "sekundy"}
                    </small>
                  </span>
                  <input
                    aria-label={label}
                    type="number"
                    inputMode="numeric"
                    min={min}
                    max={max}
                    step="1"
                    required
                    value={Number.isNaN(settings[key]) ? "" : settings[key]}
                    onChange={(event) =>
                      setSettings({
                        ...settings,
                        [key]:
                          event.target.value === ""
                            ? NaN
                            : Number(event.target.value),
                      })
                    }
                  />
                </label>
              ))}
            </div>
            <label>
              Dźwięk
              <select
                aria-label="Dźwięk"
                value={settings.sound ? "beep" : "silent"}
                onChange={(event) =>
                  setSettings({
                    ...settings,
                    sound: event.target.value === "beep",
                  })
                }
              >
                <option value="beep">Piknięcia co sekundę</option>
                <option value="silent">Cisza</option>
              </select>
            </label>
            {!validTimer(settings) && (
              <p role="alert">
                Wpisz całkowite wartości w dozwolonym zakresie. Powtórzenia i
                serie: 1–100, czasy: 0–3600 s. Przynajmniej jedna faza ruchu
                musi trwać dłużej niż 0 sekund.
              </p>
            )}
          </div>
          <div className="panel timer-summary">
            <div>
              <span>Łączny czas</span>
              <strong>{validTimer(settings) ? formatTimer(total) : "—"}</strong>
            </div>
            <button disabled={!validTimer(settings)} type="submit">
              Start
            </button>
          </div>
        </form>
      )}
      <p className="footnote">
        Przygotowanie jest przed pierwszą serią. Przerwy są tylko między
        seriami. Zegar działa także w innych zakładkach tej aplikacji. Podczas
        ćwiczenia pozostaw aplikację na ekranie — blokada telefonu lub przejście
        do innej aplikacji może zakłócić dźwięk. Ustawienia zapisują się
        automatycznie na tym urządzeniu.
      </p>
    </section>
  );
}
