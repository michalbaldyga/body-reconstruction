import Dexie, { type Table } from "dexie";
import {
  type PainLog,
  type Session,
  type WorkoutTemplate,
  defaultTemplate,
  backupSchema,
} from "./domain";
class RehabDB extends Dexie {
  logs!: Table<PainLog, string>;
  sessions!: Table<Session, string>;
  templates!: Table<WorkoutTemplate, string>;
  constructor() {
    super("body-reconstruction-v1");
    this.version(1).stores({ logs: "id,&date", sessions: "id,started" });
    this.version(2)
      .stores({
        logs: "id,&date",
        sessions: "id,started",
        templates: "id,name",
      })
      .upgrade((tx) => tx.table("templates").add(defaultTemplate()));
    this.on("populate", (tx) => {
      tx.table("templates").add(defaultTemplate());
    });
  }
}
export const db = new RehabDB();
export async function exportBackup() {
  return db.transaction("r", db.logs, db.sessions, db.templates, async () => ({
    version: 2 as const,
    templates: await db.templates.toArray(),
    exportedAt: new Date().toISOString(),
    logs: await db.logs.toArray(),
    sessions: await db.sessions.toArray(),
  }));
}
export async function importBackup(raw: unknown) {
  const data = backupSchema.parse(raw);
  await db.transaction("rw", db.logs, db.sessions, db.templates, async () => {
    await db.templates.clear();
    await db.templates.bulkAdd(
      data.version === 1 ? [defaultTemplate()] : data.templates!,
    );
    await db.logs.clear();
    await db.sessions.clear();
    await db.logs.bulkAdd(data.logs);
    await db.sessions.bulkAdd(data.sessions);
  });
}
