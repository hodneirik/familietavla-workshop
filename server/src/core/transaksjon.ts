import type { Db } from "../db/client.js";

/** Kjører jobben som én transaksjon. Går noe galt, rulles alt tilbake. */
export function iTransaksjon<T>(db: Db, jobb: () => T): T {
  db.exec("BEGIN IMMEDIATE");
  try {
    const resultat = jobb();
    db.exec("COMMIT");
    return resultat;
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
}
