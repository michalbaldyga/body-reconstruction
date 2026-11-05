import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach } from "vitest";
import { db, exportBackup, importBackup } from "./db";
import { exercises, newSession } from "./domain";
beforeEach(async () => {
  await db.logs.clear();
  await db.sessions.clear();
});
describe("Baza i kopie", () => {
  it("odtwarza wpisy i aktywną sesję bez utraty danych", async () => {
    const session = newSession(
      Object.fromEntries(
        exercises.map((e) => [e.id, { weight: e.weight, reps: e.reps }]),
      ),
    );
    await db.sessions.add(session);
    await db.logs.add({
      id: "pain",
      date: "2026-11-02",
      at: "2026-11-02T07:00:00.000Z",
      values: [2, 3, 1],
      context: "spacer",
      note: "notatka",
    });
    const before = await exportBackup();
    await db.sessions.clear();
    await db.logs.clear();
    await importBackup(JSON.parse(JSON.stringify(before)));
    expect((await exportBackup()).sessions).toEqual(before.sessions);
    expect((await exportBackup()).logs).toEqual(before.logs);
  });
  it("nie usuwa danych po niepoprawnym imporcie", async () => {
    await db.logs.add({
      id: "keep",
      date: "2026-11-02",
      at: "2026-11-02T07:00:00.000Z",
      values: [2, 2, 2],
      context: "spacer",
      note: "",
    });
    await expect(
      importBackup({ version: 9, logs: [], sessions: [] }),
    ).rejects.toThrow();
    expect(await db.logs.count()).toBe(1);
  });
});

it("eksportuje i przywraca plany razem z niezależną sesją", async () => {
  const { defaultTemplate } = await import("./domain");
  const template = { ...defaultTemplate(), id: "lower-a", name: "Lower A" };
  await db.templates.clear();
  await db.templates.add(template);
  const session = newSession({}, undefined, template);
  await db.sessions.add(session);
  const backup = await exportBackup();
  await db.templates.update(template.id, { name: "Zmieniony" });
  await importBackup(backup);
  expect(await db.templates.toArray()).toEqual([template]);
  expect((await db.sessions.get(session.id))?.planName).toBe("Lower A");
  expect(backup.version).toBe(2);
});

it("importuje kopię v1 i dodaje plan początkowy bez zmiany historii", async () => {
  const { defaultTemplate } = await import("./domain");
  const oldSession = newSession(
    Object.fromEntries(
      exercises.map((e) => [e.id, { weight: e.weight, reps: e.reps }]),
    ),
  );
  await importBackup({
    version: 1,
    exportedAt: new Date().toISOString(),
    logs: [],
    sessions: [oldSession],
  });
  expect(await db.sessions.toArray()).toEqual([oldSession]);
  expect(await db.templates.toArray()).toEqual([defaultTemplate()]);
});

it("nie usuwa danych po błędnym planie w kopii v2", async () => {
  await db.templates.put({
    id: "keep",
    name: "Zachowaj",
    entries: [
      { exerciseId: "leg-press", sets: 3, reps: 8, weight: 0, note: "" },
    ],
  });
  await expect(
    importBackup({
      version: 2,
      exportedAt: new Date().toISOString(),
      logs: [],
      sessions: [],
      templates: [{ id: "bad", name: "", entries: [] }],
    }),
  ).rejects.toThrow();
  expect(await db.templates.get("keep")).toBeDefined();
});
