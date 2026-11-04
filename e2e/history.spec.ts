import { test, expect } from "@playwright/test";
test("wspólne serie, dodawanie i edycja historii oraz znaczniki kalendarza", async ({
  page,
}) => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  await page.goto("./");
  await page.getByRole("button", { name: "Historia", exact: true }).click();
  await page.getByRole("button", { name: "Dodaj trening historyczny" }).click();
  await page.getByLabel("Początek treningu").fill(`${key}T10:00`);
  await page.getByLabel("Koniec treningu").fill(`${key}T11:00`);
  await expect(page.getByRole("checkbox")).toHaveCount(12);
  await page
    .getByLabel("Wspięcia na palce seria 1 powtórzenia", { exact: true })
    .fill("5");
  await page.getByLabel("Notatka treningu").fill("Trening historyczny testowy");
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    )
    .toBeTruthy();
  await page
    .getByRole("button", { name: "Zapisz trening", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("Trening zapisany");
  await page.locator("details summary").click();
  await expect(
    page.getByText("L+P 0 kg × 5 ✓", { exact: false }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Edytuj trening", exact: true })
    .click();
  await expect(
    page.getByLabel("Wspięcia na palce seria 1 powtórzenia", { exact: true }),
  ).toHaveValue("5");
  await page
    .getByLabel("Wspięcia na palce seria 1 powtórzenia", { exact: true })
    .fill("6");
  await page.getByLabel("Notatka treningu").fill("Poprawiony trening");
  await page
    .getByRole("button", { name: "Zapisz trening", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("Trening zapisany");
  await page.reload();
  await page.getByRole("button", { name: "Kalendarz", exact: true }).click();
  if (d.getMonth() !== new Date().getMonth())
    await page.getByRole("button", { name: "Poprzedni miesiąc" }).click();
  const cell = page.locator(`[data-date="${key}"]`);
  await expect(cell.locator(".training-dot")).toHaveCount(1);
  await expect(cell.locator(".pain-dot")).toHaveCount(0);
  await cell.click();
  await page
    .getByRole("button", { name: "Edytuj trening", exact: true })
    .click();
  await expect(
    page.getByLabel("Wspięcia na palce seria 1 powtórzenia", { exact: true }),
  ).toHaveValue("6");
  await expect(page.getByLabel("Notatka treningu")).toHaveValue(
    "Poprawiony trening",
  );
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Anuluj", exact: true }).click();
  await page.getByRole("button", { name: "Kalendarz", exact: true }).click();
  if (d.getMonth() !== new Date().getMonth())
    await page.getByRole("button", { name: "Poprzedni miesiąc" }).click();
  await cell.click();
  await page.getByRole("button", { name: "Dodaj ból", exact: true }).click();
  for (const select of await page.locator(".pain-row select").all())
    await select.selectOption("2");
  await page
    .getByRole("button", { name: "Zapisz pomiar", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("Pomiar zapisany");
  await page.getByRole("button", { name: "Kalendarz", exact: true }).click();
  if (d.getMonth() !== new Date().getMonth())
    await page.getByRole("button", { name: "Poprzedni miesiąc" }).click();
  await expect(cell.locator(".training-dot")).toHaveCount(1);
  await expect(cell.locator(".pain-dot")).toHaveCount(1);
  await cell.click();
  await page.getByRole("button", { name: "Edytuj ból", exact: true }).click();
  await page.locator(".pain-row select").first().selectOption("3");
  page.once("dialog", (dialog) => dialog.accept());
  await page
    .getByRole("button", { name: "Zapisz pomiar", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("Pomiar zapisany");
  await page.getByRole("button", { name: "Kalendarz", exact: true }).click();
  if (d.getMonth() !== new Date().getMonth())
    await page.getByRole("button", { name: "Poprzedni miesiąc" }).click();
  await cell.click();
  await expect(
    page.getByText("Ból: Achilles 3/10", { exact: false }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Edytuj trening", exact: true })
    .click();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Usuń trening", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Trening usunięty");
  await page.getByRole("button", { name: "Kalendarz", exact: true }).click();
  if (d.getMonth() !== new Date().getMonth())
    await page.getByRole("button", { name: "Poprzedni miesiąc" }).click();
  await expect(cell.locator(".training-dot")).toHaveCount(0);
  await expect(cell.locator(".pain-dot")).toHaveCount(1);
  await page.screenshot({
    path: "test-results/calendar-mobile.png",
    fullPage: true,
  });
});
