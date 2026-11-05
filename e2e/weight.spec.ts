import { test, expect } from "@playwright/test";

test("ciężar można wyczyścić, wpisać od nowa i zachować po odświeżeniu", async ({
  page,
}) => {
  await page.goto("./");
  await expect(page.locator("html")).toHaveCSS("color-scheme", "dark");
  await page.getByRole("button", { name: "Trening", exact: true }).click();
  await page
    .getByRole("button", { name: "Zatwierdź dawki i rozpocznij" })
    .click();
  const weight = page.getByLabel("Wspięcia na palce seria 1 ciężar", {
    exact: true,
  });
  await expect(weight).toHaveValue("0");
  await weight.fill("");
  await expect(weight).toBeEnabled();
  await expect(weight).toHaveValue("");
  await weight.fill("12.5");
  await expect(weight).toBeEnabled();
  await expect(weight).toHaveValue("12.5");
  await page.reload();
  await page.getByRole("button", { name: "Trening", exact: true }).click();
  await expect(weight).toHaveValue("12.5");
});

for (const touch of [false, true]) {
  test.describe(touch ? "telefon" : "komputer", () => {
    test.use({ hasTouch: touch, isMobile: touch });
    test("usunięcie zera w planie przed rozpoczęciem treningu", async ({
      page,
    }) => {
      await page.goto("./");
      await page.getByRole("button", { name: "Trening", exact: true }).click();
      const weight = page.getByLabel("Ciężar dodatkowy (kg)");
      await expect(weight).toHaveValue("0");
      if (touch) await weight.tap();
      else await weight.click();
      await weight.press("End");
      await weight.press("Backspace");
      await expect(weight).toHaveValue("");
      await weight.pressSequentially("12.5");
      await expect(weight).toHaveValue("12.5");
      await page
        .getByRole("button", { name: "Zatwierdź dawki i rozpocznij" })
        .click();
      await expect(
        page.getByLabel("Wspięcia na palce seria 1 ciężar", { exact: true }),
      ).toHaveValue("12.5");
      await page.reload();
      await page.getByRole("button", { name: "Trening", exact: true }).click();
      await expect(
        page.getByLabel("Wspięcia na palce seria 1 ciężar", { exact: true }),
      ).toHaveValue("12.5");
    });
  });
}
