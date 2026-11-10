import { test, expect } from "@playwright/test";
test("timer settings, exact phases, pause, navigation and completion", async ({
  page,
}) => {
  await page.goto("./");
  await page.getByRole("button", { name: "Zegar HSR", exact: true }).click();
  await page.getByLabel("Czas przygotowania", { exact: true }).fill("2");
  await page.getByLabel("Ruch 1", { exact: true }).fill("2");
  await page.getByLabel("Zatrzymanie", { exact: true }).fill("0");
  await page.getByLabel("Ruch 2", { exact: true }).fill("1");
  await page.getByLabel("Powtórzenia w serii", { exact: true }).fill("2");
  await page.getByLabel("Liczba serii", { exact: true }).fill("2");
  await page.getByLabel("Przerwa między seriami", { exact: true }).fill("3");
  await page.getByLabel("Dźwięk", { exact: true }).selectOption("silent");
  await expect(page.locator(".timer-summary")).toContainText("00:17");
  await page.reload();
  await page.getByRole("button", { name: "Zegar HSR", exact: true }).click();
  await expect(
    page.getByLabel("Czas przygotowania", { exact: true }),
  ).toHaveValue("2");
  await page.clock.install();
  await page.getByRole("button", { name: "Start", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Przygotowanie", exact: true }),
  ).toBeVisible();
  await page.clock.runFor(2000);
  await expect(
    page.getByRole("heading", { name: "Ruch 1", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Pauza", exact: true }).click();
  const paused = await page.getByRole("timer").textContent();
  await page.clock.runFor(10000);
  await expect(page.getByRole("timer")).toHaveText(paused!);
  await page.getByRole("button", { name: "Wznów", exact: true }).click();
  await page.clock.runFor(2000);
  await expect(
    page.getByRole("heading", { name: "Ruch 2", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Dzisiaj", exact: true }).click();
  await page.clock.runFor(4000);
  await page.getByRole("button", { name: "Zegar HSR", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Przerwa", exact: true }),
  ).toBeVisible();
  await page.clock.runFor(9000);
  await expect(
    page.getByRole("heading", { name: "Koniec", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("timer")).toHaveText("00:00");
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    )
    .toBeTruthy();
});

test("rejects all zero phases and allows skipping first phase", async ({
  page,
}) => {
  await page.goto("./");
  await page.getByRole("button", { name: "Zegar HSR", exact: true }).click();
  for (const label of ["Czas przygotowania", "Ruch 1", "Zatrzymanie", "Ruch 2"])
    await page.getByLabel(label, { exact: true }).fill("0");
  await expect(
    page.getByRole("button", { name: "Start", exact: true }),
  ).toBeDisabled();
  await page.getByLabel("Ruch 2", { exact: true }).fill("1");
  await page.getByRole("button", { name: "Start", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Ruch 2", exact: true }),
  ).toBeVisible();
  page.on("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Zakończ", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Start", exact: true }),
  ).toBeVisible();
});

test("beeps once per second and stays silent while paused", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const calls = { beeps: 0 };
    Object.assign(window, {
      timerAudioCalls: calls,
      AudioContext: class {
        state = "running";
        currentTime = 0;
        destination = {};
        resume() {
          return Promise.resolve();
        }
        close() {
          return Promise.resolve();
        }
        createOscillator() {
          return {
            frequency: { value: 0 },
            connect() {},
            disconnect() {},
            start() {
              calls.beeps++;
            },
            stop() {},
            onended: null,
          };
        }
        createGain() {
          return {
            gain: {
              setValueAtTime() {},
              linearRampToValueAtTime() {},
              exponentialRampToValueAtTime() {},
            },
            connect() {},
            disconnect() {},
          };
        }
      },
    });
  });
  await page.goto("./");
  await page.getByRole("button", { name: "Zegar HSR", exact: true }).click();
  await page.clock.install();
  await page.getByRole("button", { name: "Start", exact: true }).click();
  await page.clock.runFor(3000);
  const beeps = () =>
    page.evaluate(
      () =>
        (window as unknown as { timerAudioCalls: { beeps: number } })
          .timerAudioCalls.beeps,
    );
  expect(await beeps()).toBe(3);
  await page.getByRole("button", { name: "Pauza", exact: true }).click();
  await page.clock.runFor(5000);
  expect(await beeps()).toBe(3);
  await page.getByRole("button", { name: "Wznów", exact: true }).click();
  await page.clock.runFor(1000);
  expect(await beeps()).toBe(4);
});
