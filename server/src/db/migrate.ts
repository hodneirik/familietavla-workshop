import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Db } from "./client.js";

const here = path.dirname(fileURLToPath(import.meta.url));
export const migrationsDir = path.join(here, "migrations");

/** Kjører migrasjoner i filnavnrekkefølge. Kun fremover, hver kjøres én gang. */
export function migrate(db: Db, dir = migrationsDir): string[] {
  db.exec(
    "CREATE TABLE IF NOT EXISTS schema_migrations (navn TEXT PRIMARY KEY, kjort TEXT NOT NULL)",
  );
  const done = new Set(
    (db.prepare("SELECT navn FROM schema_migrations").all() as { navn: string }[]).map(
      (r) => r.navn,
    ),
  );
  const applied: string[] = [];
  const files = readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  for (const file of files) {
    if (done.has(file)) continue;
    const sql = readFileSync(path.join(dir, file), "utf8");
    // En migrasjon som bygger om en tabell andre tabeller peker på, må kjøre uten utenlandsnøkler.
    // Det kan ikke slås av inni en transaksjon, så det gjøres før den, og alt kontrolleres etterpå.
    const utenNokler = sql.startsWith("-- foreign_keys: off");
    if (utenNokler) db.exec("PRAGMA foreign_keys = OFF");
    try {
      db.exec("BEGIN");
      try {
        db.exec(sql);
        if (utenNokler) {
          const brudd = db.prepare("PRAGMA foreign_key_check").all();
          if (brudd.length > 0) throw new Error(`${brudd.length} brutte utenlandsnøkler`);
        }
        db.prepare("INSERT INTO schema_migrations (navn, kjort) VALUES (?, ?)").run(
          file,
          new Date().toISOString(),
        );
        db.exec("COMMIT");
      } catch (err) {
        db.exec("ROLLBACK");
        throw new Error(`Migrasjon ${file} feilet: ${err instanceof Error ? err.message : err}`);
      }
    } finally {
      if (utenNokler) db.exec("PRAGMA foreign_keys = ON");
    }
    applied.push(file);
  }
  return applied;
}
