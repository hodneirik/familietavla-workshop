import { copyFileSync, mkdtempSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { openDb } from "../src/db/client.js";
import { migrate, migrationsDir } from "../src/db/migrate.js";
import { createUser } from "../src/modules/users/service.js";

describe("migrasjon 015: påminnelser med dato og periode", () => {
  it("beholder de faste påminnelsene og tillater enkeltdager", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "mig-"));
    for (const f of readdirSync(migrationsDir).filter((f) => f < "015")) {
      copyFileSync(path.join(migrationsDir, f), path.join(dir, f));
    }
    const db = openDb(":memory:");
    migrate(db, dir);
    const barn = createUser(db, { visningsnavn: "Elias", rolle: "barn", pin: "1234" }, null);
    db.prepare("INSERT INTO paaminnelser (barn_id, tittel, ukedag) VALUES (?, 'Gym', 1)").run(
      barn.id,
    );

    copyFileSync(
      path.join(migrationsDir, "015_paaminnelser_dato.sql"),
      path.join(dir, "015_paaminnelser_dato.sql"),
    );
    expect(migrate(db, dir)).toEqual(["015_paaminnelser_dato.sql"]);

    expect(db.prepare("SELECT tittel, ukedag, dato, fra, til FROM paaminnelser").all()).toEqual([
      { tittel: "Gym", ukedag: 1, dato: null, fra: null, til: null },
    ]);
    const sett = db.prepare(
      "INSERT INTO paaminnelser (barn_id, tittel, ukedag, dato) VALUES (?, ?, ?, ?)",
    );
    sett.run(barn.id, "Turdag", null, "2026-10-16");
    // Enten ukedag eller dato, aldri begge eller ingen
    expect(() => sett.run(barn.id, "X", 1, "2026-10-16")).toThrow();
    expect(() => sett.run(barn.id, "X", null, null)).toThrow();
    // Samme på nytt (uavhengig av store bokstaver) er et brudd på unikhetsregelen
    expect(() => sett.run(barn.id, "turdag", null, "2026-10-16")).toThrow();
    expect(() => sett.run(barn.id, "Gym", 1, null)).toThrow();
  });
});
