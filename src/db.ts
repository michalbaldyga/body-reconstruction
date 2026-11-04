import Dexie, { type Table } from "dexie";
import { type PainLog, type Session, backupSchema } from "./domain";
class RehabDB extends Dexie {
  logs!: Table<PainLog, string>;
  sessions!: Table<Session, string>;
  constructor() {
    super("body-reconstruction-v1");
    this.version(1).stores({ logs: "id,&date", sessions: "id,started" });
  }
}
export const db = new RehabDB();
export async function exportBackup() {
  return db.transaction("r", db.logs, db.sessions, async () => ({
    version: 1 as const,
    exportedAt: new Date().toISOString(),
    logs: await db.logs.toArray(),
    sessions: await db.sessions.toArray(),
  }));
}
export async function importBackup(raw: unknown) {
  const data = backupSchema.parse(raw);
  await db.transaction("rw", db.logs, db.sessions, async () => {
    await db.logs.clear();
    await db.sessions.clear();
    await db.logs.bulkAdd(data.logs);
    await db.sessions.bulkAdd(data.sessions);
  });
}
