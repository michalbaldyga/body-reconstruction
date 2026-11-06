import { useEffect, useState } from "react";

const installationFinished = (worker: ServiceWorker) =>
  new Promise<void>((resolve, reject) => {
    const timeout = window.setTimeout(
      () =>
        finish(
          new Error(
            "Pobieranie aktualizacji trwa zbyt długo. Spróbuj ponownie.",
          ),
        ),
      20000,
    );
    function finish(error?: Error) {
      window.clearTimeout(timeout);
      worker.removeEventListener("statechange", changed);
      error ? reject(error) : resolve();
    }
    function changed() {
      if (worker.state === "installed" || worker.state === "activated")
        finish();
      else if (worker.state === "redundant")
        finish(
          new Error("Nie udało się pobrać aktualizacji. Spróbuj ponownie."),
        );
    }
    worker.addEventListener("statechange", changed);
    changed();
  });

export function AppUpdater({
  disabled,
  hasUnsavedChanges,
}: {
  disabled: boolean;
  hasUnsavedChanges: boolean;
}) {
  const [updating, setUpdating] = useState(false);
  const [available, setAvailable] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    let disposed = false;
    let registration: ServiceWorkerRegistration | undefined;
    const workers = new Set<ServiceWorker>();
    const check = () => {
      if (!disposed) setAvailable(!!registration?.waiting);
    };
    const found = () => {
      const worker = registration?.installing;
      if (worker) {
        workers.add(worker);
        worker.addEventListener("statechange", check);
      }
      check();
    };
    navigator.serviceWorker
      .getRegistration(import.meta.env.BASE_URL)
      .then((reg) => {
        if (disposed || !reg) return;
        registration = reg;
        reg.addEventListener("updatefound", found);
        found();
      })
      .catch(() => {});
    return () => {
      disposed = true;
      registration?.removeEventListener("updatefound", found);
      workers.forEach((worker) =>
        worker.removeEventListener("statechange", check),
      );
    };
  }, []);

  async function refresh() {
    if (
      hasUnsavedChanges &&
      !confirm(
        "Odświeżyć aplikację? Niezapisane zmiany formularza zostaną utracone. Zapisane treningi i plany pozostaną na urządzeniu.",
      )
    )
      return;
    setUpdating(true);
    setError("");
    try {
      if (!navigator.onLine)
        throw Error(
          "Brak połączenia z internetem. Połącz się z siecią i spróbuj ponownie.",
        );
      if ("serviceWorker" in navigator) {
        const registration = await navigator.serviceWorker.getRegistration(
          import.meta.env.BASE_URL,
        );
        if (registration) {
          await registration.update();
          if (registration.installing)
            await installationFinished(registration.installing);
          if (registration.waiting) {
            const waiting = registration.waiting;
            await new Promise<void>((resolve, reject) => {
              const timeout = window.setTimeout(
                () =>
                  finish(
                    new Error(
                      "Nie udało się aktywować aktualizacji. Spróbuj ponownie.",
                    ),
                  ),
                15000,
              );
              function finish(error?: Error) {
                window.clearTimeout(timeout);
                navigator.serviceWorker.removeEventListener(
                  "controllerchange",
                  changed,
                );
                error ? reject(error) : resolve();
              }
              function changed() {
                finish();
              }
              navigator.serviceWorker.addEventListener(
                "controllerchange",
                changed,
              );
              waiting.postMessage({ type: "SKIP_WAITING" });
            });
          }
        }
      }
      window.location.reload();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Nie udało się odświeżyć aplikacji. Spróbuj ponownie po połączeniu z internetem.",
      );
      setUpdating(false);
    }
  }
  return (
    <div className="app-updater">
      <button
        type="button"
        className="secondary"
        disabled={disabled || updating}
        onClick={refresh}
      >
        {updating ? "Sprawdzanie aktualizacji…" : "Odśwież aplikację"}
      </button>
      {available && (
        <p role="status">
          Dostępna nowa wersja. Naciśnij „Odśwież aplikację”, aby ją wczytać.
        </p>
      )}
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
