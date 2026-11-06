import { test, expect } from "@playwright/test";

const logs = [
  { date: "2026-10-01", values: [0, 1, 2] },
  { date: "2026-10-02", values: [2, 4, 3] },
  { date: "2026-10-05", values: [10, 8, 7] },
  { date: "2026-10-08", values: [6, 7, 5] },
].map((log) => ({
  ...log,
  id: log.date,
  at: log.date + "T06:00:00.000Z",
  context: "spacer",
  note: "",
}));

test("trzy wykresy liniowe: brak danych, wartości, klawiatura i przesuwanie palcem", async ({
  page,
  context,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("./");
  await page.getByRole("button", { name: "Historia", exact: true }).click();
  await expect(page.getByRole("region", { name: /^Wykres:/ })).toHaveCount(3);
  await expect(page.getByRole("slider")).toHaveCount(0);
  await page.getByRole("button", { name: "Dane", exact: true }).click();
  page.once("dialog", (dialog) => dialog.accept());
  await page
    .locator('input[type="file"]')
    .setInputFiles({
      name: "synthetic.json",
      mimeType: "application/json",
      buffer: Buffer.from(
        JSON.stringify({
          version: 1,
          exportedAt: new Date().toISOString(),
          logs,
          sessions: [],
        }),
      ),
    });
  await expect(page.getByRole("status")).toContainText("Kopia odtworzona");
  await page.getByRole("button", { name: "Historia", exact: true }).click();
  await expect(page.getByRole("slider")).toHaveCount(3);
  const achilles = page.getByRole("slider", {
    name: "Pomiar bólu: Achilles",
    exact: true,
  });
  await expect(achilles).toHaveAttribute("aria-valuetext", /6\/10/);
  await achilles.focus();
  await achilles.press("Home");
  await expect(achilles).toHaveAttribute("aria-valuetext", /0\/10/);
  await achilles.press("ArrowRight");
  await expect(achilles).toHaveAttribute("aria-valuetext", /2\/10/);
  await expect(achilles).toHaveAttribute("aria-valuenow", "1");
  // Oś dat: 1, 2, 5 i 8 października mają nierówne odległości.
  const circles = await achilles
    .locator("circle")
    .evaluateAll((nodes) =>
      nodes.map((node) => Number(node.getAttribute("cx"))),
    );
  expect(circles[2] - circles[1]).toBeCloseTo(3 * (circles[1] - circles[0]));
  await expect(achilles.locator('line[stroke-dasharray="5 5"]')).toHaveCount(2);
  await achilles.scrollIntoViewIfNeeded();
  const box = (await achilles.boundingBox())!;
  const x = (svgX: number) => box.x + (box.width * svgX) / 400;
  const y = box.y + box.height / 2;
  const cdp = await context.newCDPSession(page);
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: x(circles[0]), y }],
  });
  await expect(achilles).toHaveAttribute("aria-valuenow", "0");
  for (let i = 1; i < circles.length; i++) {
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: x(circles[i]), y }],
    });
    await expect(achilles).toHaveAttribute("aria-valuenow", String(i));
    await expect(achilles).toHaveAttribute(
      "aria-valuetext",
      new RegExp(`${logs[i].values[0]}/10`),
    );
  }
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await cdp.detach();
  const pht = page.getByRole("slider", {
    name: "Pomiar bólu: PHT",
    exact: true,
  });
  await pht.focus();
  await pht.press("Home");
  await expect(pht).toHaveAttribute("aria-valuetext", /1\/10/);
  await expect(achilles).toHaveAttribute("aria-valuenow", "3");
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    )
    .toBe(true);
  await page.screenshot({
    path: "test-results/pain-charts-mobile.png",
    fullPage: true,
  });
  expect(errors).toEqual([]);
});

test("pojedynczy pomiar pozostaje widoczny jako punkt bez NaN", async ({
  page,
}) => {
  await page.goto("./");
  await page.getByRole("button", { name: "Dane", exact: true }).click();
  page.once("dialog", (dialog) => dialog.accept());
  await page
    .locator('input[type="file"]')
    .setInputFiles({
      name: "single.json",
      mimeType: "application/json",
      buffer: Buffer.from(
        JSON.stringify({
          version: 1,
          exportedAt: new Date().toISOString(),
          logs: [logs[0]],
          sessions: [],
        }),
      ),
    });
  await expect(page.getByRole("status")).toContainText("Kopia odtworzona");
  await page.getByRole("button", { name: "Historia", exact: true }).click();
  const chart = page.getByRole("slider", {
    name: "Pomiar bólu: Achilles",
    exact: true,
  });
  await expect(chart.locator("circle")).toHaveCount(1);
  await expect(chart.locator("circle")).toHaveAttribute("cx", "207");
  await chart.press("ArrowRight");
  await expect(chart).toHaveAttribute("aria-valuenow", "0");
  await expect(chart).toHaveAttribute("aria-valuetext", /0\/10/);
});
