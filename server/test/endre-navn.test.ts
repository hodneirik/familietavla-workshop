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
});

async function agentFor(userId: number, pin: string) {
  const agent = request.agent(app);
  expect((await agent.post("/api/auth/login").send({ userId, pin })).status).toBe(200);
  return agent;
}

describe("endre navn", () => {
  it("en forelder kan endre navnet på andre og på seg selv", async () => {
    const f = await agentFor(forelder, "9876");
    expect(
      (await f.patch(`/api/users/${haakon}`).send({ visningsnavn: "Elias Jr." })).body,
    ).toMatchObject({
      id: haakon,
      visningsnavn: "Elias Jr.",
      rolle: "barn",
    });
    const meg = await f.patch(`/api/users/${forelder}`).send({ visningsnavn: "  Pappa  " });
    expect(meg.status).toBe(200);
    expect(meg.body.visningsnavn).toBe("Pappa");
  });

  it("økten består, og det nye navnet vises med en gang overalt", async () => {
    const f = await agentFor(forelder, "9876");
    await f.patch(`/api/users/${forelder}`).send({ visningsnavn: "Pappa" });
    expect((await f.get("/api/auth/me")).body.bruker.visningsnavn).toBe("Pappa");
    const fam = (await request(app).get("/api/auth/users")).body as { visningsnavn: string }[];
    expect(fam.map((u) => u.visningsnavn).sort()).toEqual(["Elias", "Pappa"]);
    // Poeng og gjøremål beholder koblingen, siden de peker på id og ikke navn
    await f.post("/api/gjoremal").send({ tittel: "X", poeng: 5 });
    expect((await f.get("/api/gjoremal/poeng")).body[0].bruker.visningsnavn).toBe("Elias");
  });

  it("rollen og aktiv-status røres ikke, og tomt eller for langt navn avvises", async () => {
    const f = await agentFor(forelder, "9876");
    const res = await f.patch(`/api/users/${forelder}`).send({ visningsnavn: "Pappa" });
    expect(res.body).toMatchObject({ rolle: "forelder", aktiv: 1 });
    expect((await f.patch(`/api/users/${haakon}`).send({ visningsnavn: "   " })).status).toBe(400);
    expect(
      (await f.patch(`/api/users/${haakon}`).send({ visningsnavn: "x".repeat(41) })).status,
    ).toBe(400);
  });

  it("barn og besteforeldre kan ikke endre navn, og endringen havner i loggen", async () => {
    const h = await agentFor(haakon, "1234");
    expect((await h.patch(`/api/users/${haakon}`).send({ visningsnavn: "Sjef" })).status).toBe(403);
    const b = createUser(
      db,
      { visningsnavn: "Farmor", rolle: "besteforelder", pin: "4321" },
      null,
    ).id;
    const ba = await agentFor(b, "4321");
    expect((await ba.patch(`/api/users/${b}`).send({ visningsnavn: "Sjef" })).status).toBe(403);
    const f = await agentFor(forelder, "9876");
    await f.patch(`/api/users/${haakon}`).send({ visningsnavn: "Elias H" });
    const logg = db
      .prepare("SELECT detaljer FROM audit_log WHERE handling = 'bruker_endret'")
      .all() as { detaljer: string }[];
    expect(logg.some((l) => l.detaljer.includes("Elias H"))).toBe(true);
  });
});
