import { test, expect } from "@playwright/test";
import { exercises, newSession } from "../src/domain";

test("Lower A/B, filtrowanie bazy, kopia sesji, zamiana i pełna kopia danych", async ({
  page,
  browser,
}) => {
  await page.goto("./");
  await page.getByRole("button", { name: "Plany", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Plan początkowy", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Nowy plan", exact: true }).click();
  await page.getByLabel("Nazwa planu").fill("Lower A");
  await page
    .getByRole("button", { name: "Dodaj ćwiczenie", exact: true })
    .click();
  await page.getByLabel("Sprzęt", { exact: true }).selectOption("Maszyna");
  await page.getByLabel("Szukaj ćwiczenia").fill("leg press");
  await page.getByRole("button", { name: /^Leg press na maszynie/ }).click();
  const press = page.getByRole("region", {
    name: "Ustawienia: Leg press na maszynie",
    exact: true,
  });
  await press.getByLabel("Liczba serii").selectOption("4");
  await press.getByLabel("Ciężar (kg)").fill("60");
  await press.getByLabel("Powtórzenia w serii", { exact: true }).fill("10");
  await press
    .getByLabel("Notatka do ćwiczenia: Leg press na maszynie")
    .fill("Ustawienie 3");
  await page
    .getByRole("button", { name: "Dodaj ćwiczenie", exact: true })
    .click();
  await page.getByLabel("Sprzęt", { exact: true }).selectOption("Guma");
  await page.getByLabel("Szukaj ćwiczenia").fill("clamshell");
  await page.getByRole("button", { name: /^Clamshells z gumą/ }).click();
  const clamshell = page.getByRole("region", {
    name: "Ustawienia: Clamshells z gumą",
    exact: true,
  });
  await clamshell.getByLabel("Liczba serii").selectOption("2");
  await clamshell.getByLabel("Powtórzenia w serii (na stronę)").fill("12");
  await clamshell
    .getByLabel("Notatka do ćwiczenia: Clamshells z gumą")
    .fill("Guma lekka");
  await page
    .getByRole("button", {
      name: "Przesuń w górę: Clamshells z gumą",
      exact: true,
    })
    .click();
  await expect(page.locator("form .panel h2").first()).toHaveText(
    "Clamshells z gumą",
  );
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    )
    .toBe(true);
  await page.screenshot({
    path: "test-results/plans-mobile.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Zapisz plan", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("Plan zapisany.");
  await page
    .getByRole("button", { name: "Kopiuj: Lower A", exact: true })
    .click();
  await page.getByLabel("Nazwa planu").fill("Lower B");
  await page
    .getByRole("button", { name: "Usuń: Clamshells z gumą", exact: true })
    .click();
  await page.getByRole("button", { name: "Zapisz plan", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Lower B", exact: true }),
  ).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Trening", exact: true }).click();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByLabel("Szablon treningu").selectOption({ label: "Lower A" });
  await page
    .getByRole("button", { name: "Zatwierdź dawki i rozpocznij" })
    .click();
  await expect(page.getByRole("checkbox")).toHaveCount(6);
  await expect(page.getByText("Guma lekka", { exact: true })).toBeVisible();
  // Edycja szablonu nie zmienia rozpoczętej sesji.
  await page.getByRole("button", { name: "Plany", exact: true }).click();
  await page
    .getByRole("button", { name: "Edytuj: Lower A", exact: true })
    .click();
  await page
    .getByRole("region", {
      name: "Ustawienia: Leg press na maszynie",
      exact: true,
    })
    .getByLabel("Liczba serii")
    .selectOption("1");
  await page.getByRole("button", { name: "Zapisz plan", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("Plan zapisany.");
  await page.getByRole("button", { name: "Trening", exact: true }).click();
  await expect(page.getByRole("checkbox")).toHaveCount(6);
  await page
    .getByRole("button", { name: "Zamień: Leg press na maszynie", exact: true })
    .click();
  await page.getByLabel("Szukaj ćwiczenia").fill("siedząc");
  await page.getByRole("button", { name: /^Uginanie nóg siedząc/ }).click();
  await expect(
    page.getByRole("heading", {
      name: "Uginanie nóg siedząc (leg curl)",
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.getByRole("checkbox")).toHaveCount(6);
  const curlFields = page.getByLabel(/Uginanie nóg siedząc.*powtórzenia/);
  for (const field of await curlFields.all()) {
    await expect(field).toHaveValue("");
    await field.fill("8");
    await expect(field).toBeEnabled();
  }
  for (const checkbox of await page.getByRole("checkbox").all()) {
    await checkbox.check();
    await expect(checkbox).toBeEnabled();
  }
  await page
    .getByRole("button", { name: "Zakończ trening", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("Trening ukończony");
  await page.getByRole("button", { name: "Plany", exact: true }).click();
  // Zamiana ćwiczenia dotyczyła sesji, szablon nadal ma leg press.
  const a = page.getByRole("article").filter({
    has: page.getByRole("heading", { name: "Lower A", exact: true }),
  });
  await expect(a).toContainText("Leg press na maszynie");
  page.once("dialog", (dialog) => dialog.accept());
  await page
    .getByRole("button", { name: "Usuń plan: Lower A", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Lower A", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Historia", exact: true }).click();
  await page.locator("details summary").click();
  await expect(page.locator("details")).toContainText("Lower A");
  await expect(page.locator("details")).toContainText("6/6 serii");
  await expect(page.locator("details")).toContainText("Uginanie nóg siedząc");
  await expect(page.locator("details")).toContainText("Guma lekka");
  await page
    .getByLabel("Filtr ćwiczenia w historii", { exact: true })
    .selectOption("clamshell");
  await expect(page.locator("details")).toContainText("Clamshells z gumą");
  await expect(page.locator("details")).not.toContainText(
    "Uginanie nóg siedząc",
  );
  await page
    .getByLabel("Filtr ćwiczenia w historii", { exact: true })
    .selectOption("");
  await page.getByRole("button", { name: "Dane", exact: true }).click();
  const downloadPromise = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Eksportuj pełną kopię JSON" })
    .click();
  const download = await downloadPromise;
  const restored = await browser.newContext();
  try {
    const other = await restored.newPage();
    await other.goto("./");
    await other.getByRole("button", { name: "Dane", exact: true }).click();
    other.once("dialog", (dialog) => dialog.accept());
    await other
      .locator('input[type="file"]')
      .setInputFiles((await download.path())!);
    await expect(other.getByRole("status")).toContainText("Kopia odtworzona");
    await other.getByRole("button", { name: "Plany", exact: true }).click();
    await expect(
      other.getByRole("heading", { name: "Lower B", exact: true }),
    ).toBeVisible();
    await expect(
      other.getByRole("heading", { name: "Lower A", exact: true }),
    ).toHaveCount(0);
    await other.getByRole("button", { name: "Historia", exact: true }).click();
    await expect(other.locator("details summary")).toContainText("Lower A");
  } finally {
    await restored.close();
  }
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    )
    .toBe(true);
});

test("aktualizacja istniejącej bazy v1 zachowuje trening i dodaje szablon", async ({
  page,
  baseURL,
}) => {
  const legacy = newSession(
    Object.fromEntries(
      exercises.map((e) => [e.id, { weight: e.weight, reps: e.reps }]),
    ),
  );
  // Najpierw otwieramy dokument bez aplikacji, by przygotować faktyczną bazę starej wersji.
  await page.goto(baseURL! + "icon.svg");
  await page.evaluate(async (session) => {
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open("body-reconstruction-v1", 10);
      request.onupgradeneeded = () => {
        const logs = request.result.createObjectStore("logs", {
          keyPath: "id",
        });
        logs.createIndex("date", "date", { unique: true });
        const sessions = request.result.createObjectStore("sessions", {
          keyPath: "id",
        });
        sessions.createIndex("started", "started");
      };
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction("sessions", "readwrite");
        tx.objectStore("sessions").add(session);
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => reject(tx.error);
      };
    });
  }, legacy);
  await page.goto("./");
  await page.getByRole("button", { name: "Trening", exact: true }).click();
  await expect(page.getByRole("checkbox")).toHaveCount(12);
  await page.getByRole("button", { name: "Plany", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Plan początkowy", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Historia", exact: true }).click();
  await expect(page.locator("details summary")).toContainText("W trakcie");
});
