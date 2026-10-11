import type { Db } from "../db/client.js";

export function audit(db: Db, userId: number | null, handling: string, detaljer?: object): void {
  db.prepare(
    "INSERT INTO audit_log (tidspunkt, user_id, handling, detaljer) VALUES (?, ?, ?, ?)",
  ).run(new Date().toISOString(), userId, handling, detaljer ? JSON.stringify(detaljer) : null);
}
