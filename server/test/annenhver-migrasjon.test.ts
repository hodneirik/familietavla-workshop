import { copyFileSync, mkdtempSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { openDb } from "../src/db/client.js";
import { migrate, migrationsDir } from "../src/db/migrate.js";
import { createUser } from "../src/modules/users/service.js";

describe("migrasjon 012: annenhver uke", () => {
  it("bygger om gjoremal uten å miste noe, og godtar den nye verdien", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "mig-"));
    for (const f of readdirSync(migrationsDir).filter((f) => f < "012")) {
      copyFileSync(path.join(migrationsDir, f), path.join(dir, f));
    }
    const db = openDb(":memory:");
    migrate(db, dir);
    const forelder = createUser(
      db,
      { visningsnavn: "Anita", rolle: "forelder", pin: "9876" },
      null,
    );
    const barn = createUser(db, { visningsnavn: "Elias", rolle: "barn", pin: "1234" }, null);
    const sett = db.prepare(
      "INSERT INTO gjoremal (tittel, poeng, status, eier_id, opprettet_av, gjentas, ledig_fra) VALUES (?, ?, ?, ?, ?, ?, ?)",
    );
    sett.run("Daglig", 5, "ledig", null, forelder.id, "daglig", "2026-10-08");
    sett.run("Tatt", 10, "tatt", barn.id, forelder.id, null, null);
    const godkjent = Number(
      sett.run("Ferdig", 20, "godkjent", barn.id, forelder.id, null, null).lastInsertRowid,
    );
    db.prepare(
      "INSERT INTO poeng_logg (user_id, poeng, grunn, gjoremal_id) VALUES (?, 20, 'Ferdig', ?)",
    ).run(barn.id, godkjent);
    expect(() => sett.run("X", 1, "ledig", null, forelder.id, "annenhver_uke", null)).toThrow();

    copyFileSync(
      path.join(migrationsDir, "012_annenhver_uke.sql"),
      path.join(dir, "012_annenhver_uke.sql"),
    );
    expect(migrate(db, dir)).toEqual(["012_annenhver_uke.sql"]);

    const rader = db
      .prepare("SELECT tittel, poeng, status, gjentas, ledig_fra FROM gjoremal ORDER BY id")
      .all();
    expect(rader).toEqual([
      { tittel: "Daglig", poeng: 5, status: "ledig", gjentas: "daglig", ledig_fra: "2026-10-08" },
      { tittel: "Tatt", poeng: 10, status: "tatt", gjentas: null, ledig_fra: null },
      { tittel: "Ferdig", poeng: 20, status: "godkjent", gjentas: null, ledig_fra: null },
    ]);
    expect(db.prepare("SELECT gjoremal_id FROM poeng_logg").get()).toEqual({
      gjoremal_id: godkjent,
    });
    expect(db.prepare("PRAGMA foreign_key_check").all()).toEqual([]);
    expect((db.prepare("PRAGMA foreign_keys").get() as { foreign_keys: number }).foreign_keys).toBe(
      1,
    );
    expect(() =>
      sett.run("Ny", 1, "ledig", null, forelder.id, "annenhver_uke", null),
    ).not.toThrow();
    expect(() => sett.run("Ugyldig", 1, "ledig", null, forelder.id, "hver time", null)).toThrow();
    // Indeksene finnes fortsatt, og nye id-er fortsetter fra der de var
    const indekser = db
      .prepare("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='gjoremal'")
      .all();
    expect(indekser.map((i) => (i as { name: string }).name)).toEqual(
      expect.arrayContaining(["idx_gjoremal_status", "idx_gjoremal_eier"]),
    );
    expect(
      Number(sett.run("Etter", 1, "ledig", null, forelder.id, null, null).lastInsertRowid),
    ).toBeGreaterThan(godkjent);
  });
});
