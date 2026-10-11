import { copyFileSync, mkdirSync, mkdtempSync, readdirSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { loadConfig } from "../src/config.js";
import { createLogger } from "../src/core/logger.js";
import { PROFILFARGER } from "../src/core/profilfarger.js";
import { openDb } from "../src/db/client.js";
import { migrate, migrationsDir } from "../src/db/migrate.js";
import { createUser } from "../src/modules/users/service.js";

describe("migrasjon 008: profilfarger", () => {
  it("flytter gamle farger til nærmeste i paletten og lar paletten stå", () => {
    const db = openDb(":memory:");
    const gammel = mkdtempSync(path.join(os.tmpdir(), "mig-"));
    mkdirSync(gammel, { recursive: true });
    for (const f of readdirSync(migrationsDir).filter((n) => n < "008")) {
      copyFileSync(path.join(migrationsDir, f), path.join(gammel, f));
    }
    migrate(db, gammel);
    const ins = db.prepare(
      "INSERT INTO users (visningsnavn, rolle, farge, pin_hash) VALUES (?, 'barn', ?, 'x')",
    );
    for (const [navn, farge] of [
      ["a", "#4f8cff"],
      ["b", "#2FB67C"],
      ["c", "#e8579a"],
      ["d", "#f2b134"],
      ["e", "#b4cdb0"],
      ["f", "#123456"],
    ] as const) {
      ins.run(navn, farge);
    }
    expect(migrate(db)).toEqual([
      "008_profilfarger.sql",
      "009_gjentakelse.sql",
      "010_lekser.sql",
      "011_besteforeldre.sql",
      "012_annenhver_uke.sql",
      "013_ki.sql",
      "014_paaminnelser.sql",
      "015_paaminnelser_dato.sql",
      "016_mengder.sql",
      "017_middag_regler.sql",
    ]);
    const farger = Object.fromEntries(
      (
        db.prepare("SELECT visningsnavn, farge FROM users").all() as {
          visningsnavn: string;
          farge: string;
        }[]
      ).map((r) => [r.visningsnavn, r.farge]),
    );
    expect(farger).toEqual({
      a: "#889cb0",
      b: "#82b797",
      c: "#cda89a",
      d: "#e6d8b0",
      e: "#b4cdb0",
      f: "#889cb0",
    });
  });
});

describe("profilfarger i brukeradministrasjonen", () => {
  async function oppsett() {
    const db = openDb(":memory:");
    migrate(db);
    const app = createApp({
      config: loadConfig({ SESSION_SECRET: "x".repeat(32), WEB_DIR: "/finnes-ikke" }),
      db,
      log: createLogger("error"),
    });
    const forelder = createUser(
      db,
      { visningsnavn: "Anita", rolle: "forelder", pin: "9876" },
      null,
    );
    const h = request.agent(app);
    await h.post("/api/auth/login").send({ userId: forelder.id, pin: "9876" });
    return { h, forelder };
  }

  it("nye brukere uten valgt farge får skifer", async () => {
    const { forelder } = await oppsett();
    expect(forelder.farge).toBe("#889cb0");
  });

  it("godtar alle farger i paletten og avviser andre", async () => {
    const { h } = await oppsett();
    for (const [i, farge] of PROFILFARGER.entries()) {
      const res = await h
        .post("/api/users")
        .send({ visningsnavn: `Barn ${i}`, rolle: "barn", pin: "1234", farge });
      expect(res.status, farge).toBe(201);
      expect(res.body.farge).toBe(farge);
    }
    const ugyldig = await h
      .post("/api/users")
      .send({ visningsnavn: "Ny", rolle: "barn", pin: "1234", farge: "#4f8cff" });
    expect(ugyldig.status).toBe(400);
  });

  it("avviser ikke-paletten også ved endring", async () => {
    const { h } = await oppsett();
    const barn = await h
      .post("/api/users")
      .send({ visningsnavn: "Barn", rolle: "barn", pin: "1234" });
    expect((await h.patch(`/api/users/${barn.body.id}`).send({ farge: "#ff0000" })).status).toBe(
      400,
    );
    expect((await h.patch(`/api/users/${barn.body.id}`).send({ farge: "#e6d8b0" })).status).toBe(
      200,
    );
  });
});
