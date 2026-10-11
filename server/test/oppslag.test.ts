import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { loadConfig } from "../src/config.js";
import { createLogger } from "../src/core/logger.js";
import { openDb, type Db } from "../src/db/client.js";
import { migrate } from "../src/db/migrate.js";
import { createUser } from "../src/modules/users/service.js";

let db: Db;
let app: ReturnType<typeof createApp>;
let forelder: number;
let haakon: number;
let nelly: number;

beforeEach(() => {
  db = openDb(":memory:");
  migrate(db);
  app = createApp({
    config: loadConfig({ SESSION_SECRET: "x".repeat(32), WEB_DIR: "/finnes-ikke" }),
    db,
    log: createLogger("error"),
  });
  forelder = createUser(db, { visningsnavn: "Anita", rolle: "forelder", pin: "9876" }, null).id;
  haakon = createUser(db, { visningsnavn: "Elias", rolle: "barn", pin: "1234" }, null).id;
  nelly = createUser(db, { visningsnavn: "Nelly", rolle: "barn", pin: "5678" }, null).id;
});

async function agentFor(userId: number, pin: string) {
  const agent = request.agent(app);
  const res = await agent.post("/api/auth/login").send({ userId, pin });
  expect(res.status).toBe(200);
  return agent;
}

describe("oppslagstavle", () => {
  it("krever innlogging for alle kall", async () => {
    expect((await request(app).get("/api/oppslag")).status).toBe(401);
    expect((await request(app).post("/api/oppslag").send({ tekst: "Hei" })).status).toBe(401);
    expect((await request(app).patch("/api/oppslag/1").send({ tekst: "Hei" })).status).toBe(401);
    expect((await request(app).delete("/api/oppslag/1")).status).toBe(401);
  });

  it("alle innloggede kan legge inn og se lapper, nyeste først", async () => {
    const h = await agentFor(haakon, "1234");
    const m = await agentFor(nelly, "5678");
    const ny = await h.post("/api/oppslag").send({ tekst: "  Husk gymtøy!  ", farge: "rosa" });
    expect(ny.status).toBe(201);
    expect(ny.body).toMatchObject({
      tekst: "Husk gymtøy!",
      farge: "rosa",
      kanEndre: true,
      forfatter: { id: haakon, visningsnavn: "Elias" },
    });
    db.prepare("UPDATE lapper SET opprettet = '2000-01-01T00:00:00.000Z'").run();
    await m.post("/api/oppslag").send({ tekst: "Pizza på fredag" });

    const liste = await m.get("/api/oppslag");
    expect(liste.status).toBe(200);
    expect(liste.body.map((l: { tekst: string }) => l.tekst)).toEqual([
      "Pizza på fredag",
      "Husk gymtøy!",
    ]);
    expect(liste.body[0].farge).toBe("gul");
  });

  it("avviser tom tekst, for lang tekst og ukjent farge", async () => {
    const h = await agentFor(haakon, "1234");
    expect((await h.post("/api/oppslag").send({ tekst: "   " })).status).toBe(400);
    expect((await h.post("/api/oppslag").send({ tekst: "a".repeat(281) })).status).toBe(400);
    expect((await h.post("/api/oppslag").send({ tekst: "Hei", farge: "svart" })).status).toBe(400);
  });

  it("man kan endre og slette sine egne lapper", async () => {
    const h = await agentFor(haakon, "1234");
    const { body } = await h.post("/api/oppslag").send({ tekst: "Første" });
    const endret = await h.patch(`/api/oppslag/${body.id}`).send({ tekst: "Andre", farge: "blå" });
    expect(endret.status).toBe(200);
    expect(endret.body).toMatchObject({ tekst: "Andre", farge: "blå" });
    expect(endret.body.endret).toEqual(expect.any(String));
    expect((await h.delete(`/api/oppslag/${body.id}`)).status).toBe(204);
    expect((await h.get("/api/oppslag")).body).toEqual([]);
  });

  it("et barn kan ikke endre eller slette andres lapper", async () => {
    const h = await agentFor(haakon, "1234");
    const m = await agentFor(nelly, "5678");
    const { body } = await h.post("/api/oppslag").send({ tekst: "Eliass lapp" });

    const lest = await m.get("/api/oppslag");
    expect(lest.body[0].kanEndre).toBe(false);
    expect((await m.patch(`/api/oppslag/${body.id}`).send({ tekst: "Hacket" })).status).toBe(403);
    expect((await m.delete(`/api/oppslag/${body.id}`)).status).toBe(403);

    const igjen = await h.get("/api/oppslag");
    expect(igjen.body).toHaveLength(1);
    expect(igjen.body[0].tekst).toBe("Eliass lapp");
  });

  it("forelder kan endre og slette alles lapper, og det logges", async () => {
    const h = await agentFor(haakon, "1234");
    const f = await agentFor(forelder, "9876");
    const { body } = await h.post("/api/oppslag").send({ tekst: "Dumt innlegg" });

    const liste = await f.get("/api/oppslag");
    expect(liste.body[0].kanEndre).toBe(true);
    const endret = await f.patch(`/api/oppslag/${body.id}`).send({ tekst: "Ryddet" });
    expect(endret.status).toBe(200);
    expect(endret.body.forfatter.id).toBe(haakon);
    expect((await f.delete(`/api/oppslag/${body.id}`)).status).toBe(204);

    const logg = db
      .prepare("SELECT handling, user_id FROM audit_log WHERE handling LIKE 'lapp_%' ORDER BY id")
      .all() as { handling: string; user_id: number }[];
    expect(logg).toEqual([
      { handling: "lapp_opprettet", user_id: haakon },
      { handling: "lapp_endret", user_id: forelder },
      { handling: "lapp_slettet", user_id: forelder },
    ]);
  });

  it("gir 404 for lapper som ikke finnes", async () => {
    const f = await agentFor(forelder, "9876");
    expect((await f.patch("/api/oppslag/999").send({ tekst: "Hei" })).status).toBe(404);
    expect((await f.delete("/api/oppslag/999")).status).toBe(404);
  });

  it("deaktivert bruker mister tilgang, men lappene blir stående", async () => {
    const h = await agentFor(haakon, "1234");
    await h.post("/api/oppslag").send({ tekst: "Blir stående" });
    db.prepare("UPDATE users SET aktiv = 0 WHERE id = ?").run(haakon);
    expect((await h.get("/api/oppslag")).status).toBe(401);
    const f = await agentFor(forelder, "9876");
    expect((await f.get("/api/oppslag")).body).toHaveLength(1);
  });
});
