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
