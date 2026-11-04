import { test, expect } from "@playwright/test";
test("poranny wpis, wznowienie i ukończenie sesji, kopia oraz offline", async ({
  page,
  context,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("./");
  await expect(
    page.getByRole("heading", { name: /Wracaj do ruchu/ }),
  ).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    )
    .toBeTruthy();
  await page.getByRole("button", { name: "Zapisz ból" }).click();
  // Zapis z godziny bieżącej, również gdy test uruchomiono przed 08:00.
  await page.getByLabel("Godzina pomiaru").fill(
    new Date().toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Europe/Warsaw",
    }),
  );
  for (const select of await page.locator(".pain-row select").all())
    await select.selectOption("2");
  await page
    .getByRole("button", { name: "Zapisz pomiar", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("Pomiar zapisany");
  await page.reload();
  await page.getByRole("button", { name: "Historia", exact: true }).click();
  await expect(page.getByText("Achilles: 2", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "Trening", exact: true }).click();
  await page
    .getByRole("button", { name: "Zatwierdź dawki i rozpocznij" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Twój trening trwa" }),
  ).toBeVisible();
  await expect(page.getByRole("checkbox")).toHaveCount(12);
  await page.getByRole("checkbox").first().check();
  await expect(page.getByText(/1\/12 serii/)).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Trening", exact: true }).click();
  await expect(page.getByRole("checkbox").first()).toBeChecked();
  for (const box of await page.getByRole("checkbox").all()) {
    await expect(box).toBeEnabled();
    if (!(await box.isChecked())) {
      await box.check();
      await expect(box).toBeEnabled();
    }
  }
  await page
    .getByRole("button", { name: "Zakończ trening", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("Trening ukończony");
  await expect(
    page.getByRole("button", { name: "Zatwierdź dawki i rozpocznij" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Dane", exact: true }).click();
  const downloadPromise = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Eksportuj pełną kopię JSON" })
    .click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/rehab-.*\.json/);
  await page.locator("input[type=file]").setInputFiles({
    name: "bad.json",
    mimeType: "application/json",
    buffer: Buffer.from('{"version":9}'),
  });
  await expect(page.getByRole("alert")).toBeVisible();
  const restoredContext = await context.browser()!.newContext({
    viewport: { width: 1440, height: 1000 },
    timezoneId: "Europe/Warsaw",
  });
  const restored = await restoredContext.newPage();
  await restored.goto(
    "http://localhost:4176" + (process.env.VITE_BASE_PATH || "/"),
  );
  await restored.screenshot({
    path: "test-results/desktop.png",
    fullPage: true,
  });
  await restored.getByRole("button", { name: "Dane", exact: true }).click();
  restored.once("dialog", (dialog) => dialog.accept());
  await restored
    .locator("input[type=file]")
    .setInputFiles((await download.path())!);
  await expect(restored.getByRole("status")).toContainText("Kopia odtworzona");
  await restored.getByRole("button", { name: "Historia", exact: true }).click();
  await expect(
    restored.getByText("Achilles: 2", { exact: false }),
  ).toBeVisible();
  await expect(restored.getByText("Ukończony", { exact: false })).toBeVisible();
  await restoredContext.close();
  await page.reload();
  await page.getByRole("button", { name: "Historia", exact: true }).click();
  await expect(page.getByText("Ukończony", { exact: false })).toBeVisible();
  await page.evaluate(() => navigator.serviceWorker.ready);
  await expect
    .poll(() => page.evaluate(() => !!navigator.serviceWorker.controller))
    .toBeTruthy();
  await context.setOffline(true);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: /Wracaj do ruchu/ }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Historia", exact: true }).click();
  await expect(page.getByText("Ukończony", { exact: false })).toBeVisible();
  expect(errors).toEqual([]);
  await page.screenshot({ path: "test-results/mobile.png", fullPage: true });
});
