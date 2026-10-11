import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { loadConfig } from "../src/config.js";
import { createLogger } from "../src/core/logger.js";
import { openDb } from "../src/db/client.js";
import { migrate } from "../src/db/migrate.js";
import { createUser } from "../src/modules/users/service.js";

const env = { SESSION_SECRET: "x".repeat(32), WEB_DIR: "/finnes-ikke" };

function lagApp() {
  const db = openDb(":memory:");
  migrate(db);
  const app = createApp({ config: loadConfig(env), db, log: createLogger("error") });
  return { app, db };
}

describe("app", () => {
  it("svarer på /api/health mot tom database", async () => {
    const { app } = lagApp();
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok" });
  });

  it("gir 404 på ukjent api-sti", async () => {
    const { app } = lagApp();
    const res = await request(app).get("/api/finnes-ikke");
    expect(res.status).toBe(404);
  });

  it("setter sikkerhetshoder", async () => {
    const { app } = lagApp();
    const res = await request(app).get("/api/health");
    expect(res.headers["content-security-policy"]).toContain("default-src 'self'");
    expect(res.headers["x-powered-by"]).toBeUndefined();
  });

  it("avviser endrende kall fra fremmed opprinnelse", async () => {
    const { app } = lagApp();
    const res = await request(app).post("/api/health").set("Origin", "https://ond.example");
    expect(res.status).toBe(403);
  });
});

describe("config", () => {
  it("nekter å starte uten SESSION_SECRET", () => {
    expect(() => loadConfig({})).toThrow(/SESSION_SECRET/);
  });
  it("nekter for kort SESSION_SECRET", () => {
    expect(() => loadConfig({ SESSION_SECRET: "kort" })).toThrow(/SESSION_SECRET/);
  });
});

describe("migrasjoner", () => {
  it("lager alle tabeller og kjøres bare én gang", () => {
    const db = openDb(":memory:");
    expect(migrate(db)).toEqual([
      "001_init.sql",
      "002_oppslagstavle.sql",
      "003_gjoremal.sql",
      "004_kalender.sql",
      "005_handleliste.sql",
      "006_middag.sql",
      "007_middagsretter.sql",
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
    expect(migrate(db)).toEqual([]);
    const tabeller = (
      db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as { name: string }[]
    ).map((t) => t.name);
    for (const t of [
      "users",
      "sessions",
      "auth_attempts",
      "audit_log",
      "events",
      "event_participants",
      "settings",
      "lapper",
      "gjoremal",
      "lekser",
      "paaminnelser",
      "poeng_logg",
      "kalendere",
      "handleliste",
      "kjente_varer",
      "middag",
      "retter",
      "middag_stjerner",
      "handleliste_middag",
    ]) {
      expect(tabeller).toContain(t);
    }
  });
});

describe("bak en proxy", () => {
  const lagAuto = () => {
    const db = openDb(":memory:");
    migrate(db);
    createUser(db, { visningsnavn: "Anita", rolle: "forelder", pin: "9876" }, null);
    return createApp({
      config: loadConfig({ ...env, COOKIE_SECURE: "auto", TRUST_PROXY: "1" }),
      db,
      log: createLogger("error"),
    });
  };

  it("avviser «null»-opprinnelse med 403, ikke 500", async () => {
    const { app } = lagApp();
    const res = await request(app).post("/api/auth/logout").set("Origin", "null");
    expect(res.status).toBe(403);
  });

  it("auto: Secure-cookie over https, vanlig cookie over http", async () => {
    const app = lagAuto();
    const https = await request(app)
      .post("/api/auth/login")
      .set("X-Forwarded-Proto", "https")
      .send({ userId: 1, pin: "9876" });
    expect(https.headers["set-cookie"]?.[0]).toMatch(/Secure/i);
    const http = await request(app).post("/api/auth/login").send({ userId: 1, pin: "9876" });
    expect(http.headers["set-cookie"]?.[0]).not.toMatch(/Secure/i);
  });
});
