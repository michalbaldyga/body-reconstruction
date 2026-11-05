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
