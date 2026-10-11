import { mkdtempSync, readdirSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { gjenopprett, lagBackup, rydd, sjekkDatabase } from "../src/db/backup.js";
import { openDb } from "../src/db/client.js";
import { migrate } from "../src/db/migrate.js";
import { createUser } from "../src/modules/users/service.js";

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), "tavla-"));
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

function lagDb() {
  const db = openDb(dir);
  migrate(db);
  createUser(db, { visningsnavn: "Anita", rolle: "forelder", pin: "9876" }, null);
  createUser(db, { visningsnavn: "Elias", rolle: "barn", pin: "1234" }, null);
  return db;
}

describe("backup", () => {
  it("tar en gyldig kopi mens databasen er i bruk", () => {
    const db = lagDb();
    const r = lagBackup(db, dir, new Date("2026-10-06T03:00:00Z"));
    expect(r.navn).toBe("tavla-20261006-030000.db");
    expect(r.brukere).toBe(2);
    expect(sjekkDatabase(r.fil).brukere).toBe(2);
  });

  it("beholder bare de nyeste", () => {
    const db = lagDb();
    for (let dag = 1; dag <= 5; dag++) {
      lagBackup(db, dir, new Date(`2026-10-0${dag}T03:00:00Z`), 3);
    }
    const filer = readdirSync(path.join(dir, "backups")).sort();
    expect(filer).toEqual([
      "tavla-20261003-030000.db",
      "tavla-20261004-030000.db",
      "tavla-20261005-030000.db",
    ]);
  });

  it("rydd rører ikke andre filer", () => {
    const db = lagDb();
    lagBackup(db, dir, new Date("2026-10-01T03:00:00Z"), 1);
    const b = path.join(dir, "backups");
    writeFileSync(path.join(b, "notat.txt"), "behold meg");
    rydd(b, 0);
    expect(existsSync(path.join(b, "notat.txt"))).toBe(true);
  });

  it("nekter å overskrive en backup med samme tidspunkt", () => {
    const db = lagDb();
    const t = new Date("2026-10-06T03:00:00Z");
    lagBackup(db, dir, t);
    expect(() => lagBackup(db, dir, t)).toThrow(/finnes allerede/);
  });
});

describe("gjenoppretting", () => {
  it("legger tilbake data og tar vare på den forrige databasen", () => {
    const db = lagDb();
    const b = lagBackup(db, dir, new Date("2026-10-06T03:00:00Z"));
    createUser(db, { visningsnavn: "Nelly", rolle: "barn", pin: "4321" }, null);
    db.close();

    const r = gjenopprett(b.fil, dir, new Date("2026-10-06T10:00:00Z"));
    expect(r.brukere).toBe(2);
    expect(r.reserve).toMatch(/før-gjenoppretting-20261006-100000$/);
    expect(sjekkDatabase(path.join(dir, "tavla.db")).brukere).toBe(2);
    expect(sjekkDatabase(r.reserve!).brukere).toBe(3);
  });

  it("nekter å bruke en fil som ikke er en tavle-database", () => {
    const rar = path.join(dir, "rar.db");
    const x = new DatabaseSync(rar);
    x.exec("CREATE TABLE noe (a)");
    x.close();
    expect(() => gjenopprett(rar, dir)).toThrow(/ikke ut som en Familietavla-database/);
  });

  it("nekter en skadet fil og rører ikke dagens database", () => {
    const db = lagDb();
    db.close();
    const skadet = path.join(dir, "skadet.db");
    writeFileSync(skadet, "dette er ikke sqlite");
    expect(() => gjenopprett(skadet, dir)).toThrow();
    expect(sjekkDatabase(path.join(dir, "tavla.db")).brukere).toBe(2);
  });
});
