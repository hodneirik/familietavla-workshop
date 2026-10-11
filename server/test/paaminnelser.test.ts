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
let besteforelder: number;
let naa = Date.parse("2026-10-14T10:00:00Z"); // onsdag

beforeEach(() => {
  naa = Date.parse("2026-10-14T10:00:00Z");
  db = openDb(":memory:");
  migrate(db);
  app = createApp({
    config: loadConfig({ SESSION_SECRET: "x".repeat(32), WEB_DIR: "/finnes-ikke" }),
    db,
    log: createLogger("error"),
    naa: () => naa,
  });
  forelder = createUser(db, { visningsnavn: "Anita", rolle: "forelder", pin: "9876" }, null).id;
  haakon = createUser(db, { visningsnavn: "Elias", rolle: "barn", pin: "1234" }, null).id;
  nelly = createUser(db, { visningsnavn: "Nelly", rolle: "barn", pin: "5678" }, null).id;
  besteforelder = createUser(
    db,
    { visningsnavn: "Farmor og farfar", rolle: "besteforelder", pin: "1111" },
    null,
  ).id;
});

async function agentFor(userId: number, pin: string) {
  const agent = request.agent(app);
  expect((await agent.post("/api/auth/login").send({ userId, pin })).status).toBe(200);
  return agent;
}
type Agent = Awaited<ReturnType<typeof agentFor>>;

const lag = async (f: Agent, data: object = {}) =>
  f.post("/api/paaminnelser").send({ barnIder: [haakon], ukedager: [1], tittel: "Gym", ...data });

describe("påminnelser: tilgang", () => {
  it("krever innlogging", async () => {
    expect((await request(app).get("/api/paaminnelser")).status).toBe(401);
    expect((await request(app).post("/api/paaminnelser").send({})).status).toBe(401);
  });

  it("bare foreldre legger inn, endrer og sletter", async () => {
    const f = await agentFor(forelder, "9876");
    const h = await agentFor(haakon, "1234");
    const b = await agentFor(besteforelder, "1111");
    expect((await lag(h)).status).toBe(403);
    expect((await lag(b)).status).toBe(403);
    const id = (await lag(f)).body[0].id as number;
    expect((await h.patch(`/api/paaminnelser/${id}`).send({ tittel: "Annet" })).status).toBe(403);
    expect((await b.delete(`/api/paaminnelser/${id}`)).status).toBe(403);
    expect((await h.delete(`/api/paaminnelser/${id}`)).status).toBe(403);
    expect((await f.patch(`/api/paaminnelser/${id}`).send({ ukedag: 3 })).body).toMatchObject({
      ukedag: 3,
      tittel: "Gym",
    });
    expect((await f.delete(`/api/paaminnelser/${id}`)).status).toBe(204);
    expect((await f.get("/api/paaminnelser")).body).toEqual([]);
  });

  it("barn ser bare sine egne, voksne ser alle, og besteforeldre kan lese", async () => {
    const f = await agentFor(forelder, "9876");
    await lag(f, { barnIder: [haakon, nelly], ukedager: [1, 3], tittel: "Bibliotek" });
    const h = await agentFor(haakon, "1234");
    const b = await agentFor(besteforelder, "1111");
    const egne = (await h.get("/api/paaminnelser")).body as { barn: { id: number } }[];
    expect(egne).toHaveLength(2);
    expect(egne.every((p) => p.barn.id === haakon)).toBe(true);
    expect((await f.get("/api/paaminnelser")).body).toHaveLength(4);
    expect((await b.get("/api/paaminnelser")).body).toHaveLength(4);
  });
});

describe("påminnelser: innhold", () => {
  it("lager én rad per barn og ukedag, sortert etter ukedag og barn", async () => {
    const f = await agentFor(forelder, "9876");
    const res = await lag(f, { barnIder: [nelly, haakon], ukedager: [4, 1], tittel: "Gym" });
    expect(res.status).toBe(201);
    const liste = (await f.get("/api/paaminnelser")).body as {
      ukedag: number;
      barn: { visningsnavn: string };
    }[];
    expect(liste.map((p) => [p.ukedag, p.barn.visningsnavn])).toEqual([
      [1, "Elias"],
      [1, "Nelly"],
      [4, "Elias"],
      [4, "Nelly"],
    ]);
  });

  it("legger ikke inn det samme to ganger, uavhengig av store og små bokstaver", async () => {
    const f = await agentFor(forelder, "9876");
    const a = (await lag(f)).body[0].id;
    const b = (await lag(f, { tittel: "gym" })).body[0].id;
    expect(b).toBe(a);
    expect((await f.get("/api/paaminnelser")).body).toHaveLength(1);
  });

  it("avviser ugyldige data", async () => {
    const f = await agentFor(forelder, "9876");
    expect((await lag(f, { tittel: "  " })).status).toBe(400);
    expect((await lag(f, { tittel: "x".repeat(61) })).status).toBe(400);
    expect((await lag(f, { ukedager: [7] })).status).toBe(400);
    expect((await lag(f, { ukedager: [] })).status).toBe(400);
    expect((await lag(f, { barnIder: [] })).status).toBe(400);
    expect((await lag(f, { barnIder: [forelder] })).status).toBe(400);
    expect((await lag(f, { barnIder: [besteforelder] })).status).toBe(400);
  });

  it("gir 409 når en endring blir lik en som finnes, og 404 for ukjent id", async () => {
    const f = await agentFor(forelder, "9876");
    await lag(f, { ukedager: [1] });
    const id = (await lag(f, { ukedager: [2] })).body[0].id as number;
    expect((await f.patch(`/api/paaminnelser/${id}`).send({ ukedag: 1 })).status).toBe(409);
    expect((await f.patch("/api/paaminnelser/999").send({ ukedag: 1 })).status).toBe(404);
    expect((await f.delete("/api/paaminnelser/999")).status).toBe(404);
  });

  it("slettes sammen med barnet", async () => {
    const f = await agentFor(forelder, "9876");
    await lag(f);
    db.prepare("DELETE FROM users WHERE id = ?").run(haakon);
    expect((await f.get("/api/paaminnelser")).body).toEqual([]);
  });

  it("logger i revisjonsloggen", async () => {
    const f = await agentFor(forelder, "9876");
    const id = (await lag(f)).body[0].id as number;
    await f.delete(`/api/paaminnelser/${id}`);
    const handlinger = (
      db.prepare("SELECT handling FROM audit_log WHERE handling LIKE 'paaminnelse%'").all() as {
        handling: string;
      }[]
    ).map((r) => r.handling);
    expect(handlinger).toEqual(["paaminnelse_lagt_inn", "paaminnelse_slettet"]);
  });
});

describe("påminnelser: enkeltdager og perioder", () => {
  const forelderAgent = () => agentFor(forelder, "9876");

  it("en enkeltdag har dato og ingen ukedag", async () => {
    const f = await forelderAgent();
    const res = await f
      .post("/api/paaminnelser")
      .send({ barnIder: [haakon], tittel: "Turdag", dato: "2026-10-16" });
    expect(res.status).toBe(201);
    expect(res.body[0]).toMatchObject({
      tittel: "Turdag",
      ukedag: null,
      dato: "2026-10-16",
      fra: null,
      til: null,
    });
  });

  it("en periode har ukedag med fra og til", async () => {
    const f = await forelderAgent();
    const res = await lag(f, {
      tittel: "Svømming",
      ukedager: [2],
      fra: "2026-10-14",
      til: "2026-11-04",
    });
    expect(res.status).toBe(201);
    expect(res.body[0]).toMatchObject({
      ukedag: 2,
      dato: null,
      fra: "2026-10-14",
      til: "2026-11-04",
    });
  });

  it("avviser blanding av ukedag og dato, enkeltdag med periode og ugyldige datoer", async () => {
    const f = await forelderAgent();
    expect((await lag(f, { dato: "2026-10-16" })).status).toBe(400);
    expect(
      (
        await f
          .post("/api/paaminnelser")
          .send({ barnIder: [haakon], tittel: "X", dato: "2026-10-16", fra: "2026-10-01" })
      ).status,
    ).toBe(400);
    expect(
      (await f.post("/api/paaminnelser").send({ barnIder: [haakon], tittel: "X" })).status,
    ).toBe(400);
    expect(
      (
        await f
          .post("/api/paaminnelser")
          .send({ barnIder: [haakon], tittel: "X", dato: "i morgen" })
      ).status,
    ).toBe(400);
    expect((await lag(f, { fra: "2026-11-04", til: "2026-10-14" })).status).toBe(400);
  });

  it("samme tittel kan finnes både som fast ukedag og som enkeltdag, men ikke dobbelt", async () => {
    const f = await forelderAgent();
    await lag(f, { ukedager: [4] });
    await f
      .post("/api/paaminnelser")
      .send({ barnIder: [haakon], tittel: "Gym", dato: "2026-10-16" });
    await f
      .post("/api/paaminnelser")
      .send({ barnIder: [haakon], tittel: "gym", dato: "2026-10-16" });
    expect((await f.get("/api/paaminnelser")).body).toHaveLength(2);
  });

  it("det som er over vises ikke, og de faste kommer først", async () => {
    const f = await forelderAgent();
    await f
      .post("/api/paaminnelser")
      .send({ barnIder: [haakon], tittel: "Gammel tur", dato: "2026-10-01" });
    await f
      .post("/api/paaminnelser")
      .send({ barnIder: [haakon], tittel: "Idag", dato: "2026-10-14" });
    await f
      .post("/api/paaminnelser")
      .send({ barnIder: [haakon], tittel: "Senere", dato: "2026-10-20" });
    await lag(f, { tittel: "Ferdig periode", ukedager: [1], fra: "2026-09-01", til: "2026-10-07" });
    await lag(f, { tittel: "Gym", ukedager: [3] });
    const titler = ((await f.get("/api/paaminnelser")).body as { tittel: string }[]).map(
      (p) => p.tittel,
    );
    expect(titler).toEqual(["Gym", "Idag", "Senere"]);
  });

  it("rydder bort gamle enkeltdager og perioder når noe nytt legges inn", async () => {
    const f = await forelderAgent();
    await f
      .post("/api/paaminnelser")
      .send({ barnIder: [haakon], tittel: "Gammel", dato: "2026-08-01" });
    await lag(f, { tittel: "Gammel periode", ukedager: [1], til: "2026-09-01" });
    // Den første ble ryddet bort da den andre ble lagt inn. Den andre rydder seg selv ved neste innlegging.
    expect(db.prepare("SELECT tittel FROM paaminnelser").all()).toEqual([
      { tittel: "Gammel periode" },
    ]);
    await lag(f, { tittel: "Ny" });
    expect(db.prepare("SELECT tittel FROM paaminnelser").all()).toEqual([{ tittel: "Ny" }]);
  });

  it("kan endre dato på en enkeltdag og periode på en fast, men ikke blande", async () => {
    const f = await forelderAgent();
    const tur = (
      await f
        .post("/api/paaminnelser")
        .send({ barnIder: [haakon], tittel: "Tur", dato: "2026-10-16" })
    ).body[0].id as number;
    const fast = (await lag(f)).body[0].id as number;
    expect(
      (await f.patch(`/api/paaminnelser/${tur}`).send({ dato: "2026-10-21" })).body,
    ).toMatchObject({
      dato: "2026-10-21",
    });
    expect((await f.patch(`/api/paaminnelser/${tur}`).send({ ukedag: 2 })).status).toBe(400);
    expect((await f.patch(`/api/paaminnelser/${fast}`).send({ dato: "2026-10-21" })).status).toBe(
      400,
    );
    expect(
      (await f.patch(`/api/paaminnelser/${fast}`).send({ fra: "2026-10-14", til: "2026-11-11" }))
        .body,
    ).toMatchObject({ fra: "2026-10-14", til: "2026-11-11" });
    expect((await f.patch(`/api/paaminnelser/${fast}`).send({ fra: "2026-12-01" })).status).toBe(
      400,
    );
    expect(
      (await f.patch(`/api/paaminnelser/${fast}`).send({ fra: null, til: null })).body,
    ).toMatchObject({
      fra: null,
      til: null,
    });
  });
});
