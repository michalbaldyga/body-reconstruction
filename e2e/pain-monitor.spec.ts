import { test, expect } from "@playwright/test";
import { newSession, defaultTemplate, day } from "../src/domain";

test("monitor trzech pomiarów i rozpoczęcie treningu po 71 godzinach", async ({
  page,
}) => {
  await page.clock.install({ time: new Date("2026-11-05T15:00:00Z") });
  const base = newSession({}, "2026-11-02T15:00:00Z", defaultTemplate());
  const session = {
    ...base,
    ended: "2026-11-02T16:00:00Z",
    sets: base.sets.map((s) => ({ ...s, done: true, reps: 6 })),
  };
  const logs = [2, 4, 0].map((value, i) => {
    const at = new Date(`2026-11-0${i + 2}T07:00:00Z`);
    return {
      id: String(i),
      date: day(at),
      at: at.toISOString(),
      values: [value, value, value],
      context: "spacer",
      note: "",
    };
  });
  await page.goto("./");
  await page.getByRole("button", { name: "Dane", exact: true }).click();
  page.once("dialog", (dialog) => dialog.accept());
  await page.locator('input[type="file"]').setInputFiles({
    name: "backup.json",
    mimeType: "application/json",
    buffer: Buffer.from(
      JSON.stringify({
        version: 1,
        exportedAt: new Date().toISOString(),
        sessions: [session],
        logs,
      }),
    ),
  });
  await expect(page.getByRole("status")).toContainText("Kopia odtworzona");
  await page.getByRole("button", { name: "Trening", exact: true }).click();
  await expect(
    page.getByText("Od ostatniego treningu minęło 71 h."),
  ).toBeVisible();
  const monitor = page.getByRole("region", {
    name: "Monitor bólu po ostatnim treningu",
  });
  for (const [i, label] of [
    "Przed treningiem",
    "Po około 24 h",
    "Po około 48 h",
  ].entries()) {
    const card = monitor
      .getByRole("article")
      .filter({ has: page.getByRole("heading", { name: label, exact: true }) });
    await expect(card).toContainText(`Achilles: ${[2, 4, 0][i]} / 10`);
  }
  await expect(
    page.getByText("Propozycje dla ćwiczeń z planu początkowego"),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Zatwierdź dawki i rozpocznij" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Twój trening trwa" }),
  ).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Trening", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Twój trening trwa" }),
  ).toBeVisible();
});
