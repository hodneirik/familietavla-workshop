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
  expect((await agent.post("/api/auth/login").send({ userId, pin })).status).toBe(200);
  return agent;
}

type Agent = Awaited<ReturnType<typeof agentFor>>;

async function nyttGjoremal(f: Agent, tittel = "Tømme oppvaskmaskinen", poeng = 10) {
  const res = await f.post("/api/gjoremal").send({ tittel, poeng });
  expect(res.status).toBe(201);
  return res.body as { id: number };
}

const poengFor = async (a: Agent) => (await a.get("/api/gjoremal/poeng")).body;

describe("gjøremål: tilgang og opprettelse", () => {
  it("krever innlogging", async () => {
    expect((await request(app).get("/api/gjoremal")).status).toBe(401);
    expect((await request(app).get("/api/gjoremal/poeng")).status).toBe(401);
    expect((await request(app).post("/api/gjoremal").send({ tittel: "x" })).status).toBe(401);
    expect((await request(app).post("/api/gjoremal/1/ta")).status).toBe(401);
  });

  it("bare forelder kan opprette, endre og slette", async () => {
    const f = await agentFor(forelder, "9876");
    const h = await agentFor(haakon, "1234");
    expect((await h.post("/api/gjoremal").send({ tittel: "Fusk", poeng: 99 })).status).toBe(403);
    const { id } = await nyttGjoremal(f);
    expect((await h.patch(`/api/gjoremal/${id}`).send({ poeng: 500 })).status).toBe(403);
    expect((await h.delete(`/api/gjoremal/${id}`)).status).toBe(403);
    const endret = await f.patch(`/api/gjoremal/${id}`).send({ tittel: "Rydde rommet", poeng: 15 });
    expect(endret.body).toMatchObject({ tittel: "Rydde rommet", poeng: 15, status: "ledig" });
    expect((await f.delete(`/api/gjoremal/${id}`)).status).toBe(204);
  });

  it("validerer tittel og poeng, og poeng er valgfritt", async () => {
    const f = await agentFor(forelder, "9876");
    expect((await f.post("/api/gjoremal").send({ tittel: "  ", poeng: 5 })).status).toBe(400);
    expect((await f.post("/api/gjoremal").send({ tittel: "x", poeng: -1 })).status).toBe(400);
    expect((await f.post("/api/gjoremal").send({ tittel: "x", poeng: 1001 })).status).toBe(400);
    expect((await f.post("/api/gjoremal").send({ tittel: "x", poeng: 2.5 })).status).toBe(400);
    expect((await f.post("/api/gjoremal").send({ tittel: "x".repeat(81) })).status).toBe(400);
    const uten = await f.post("/api/gjoremal").send({ tittel: "Bare for gøy" });
    expect(uten.body.poeng).toBe(0);
  });

  it("alle innloggede ser alle gjøremål med eier", async () => {
    const f = await agentFor(forelder, "9876");
    const h = await agentFor(haakon, "1234");
    const m = await agentFor(nelly, "5678");
    const { id } = await nyttGjoremal(f);
    await nyttGjoremal(f, "Dekke bordet", 5);
    await h.post(`/api/gjoremal/${id}/ta`);
    const liste = await m.get("/api/gjoremal");
    expect(liste.body).toHaveLength(2);
    expect(liste.body.find((g: { id: number }) => g.id === id).eier.visningsnavn).toBe("Elias");
  });
});

describe("gjøremål: eie, fullføre og godkjenne", () => {
  it("når et barn eier et gjøremål kan ikke andre barn ta det", async () => {
    const f = await agentFor(forelder, "9876");
    const h = await agentFor(haakon, "1234");
    const m = await agentFor(nelly, "5678");
    const { id } = await nyttGjoremal(f);
    const tatt = await h.post(`/api/gjoremal/${id}/ta`);
    expect(tatt.status).toBe(200);
    expect(tatt.body).toMatchObject({ status: "tatt", eier: { id: haakon } });
    const avvist = await m.post(`/api/gjoremal/${id}/ta`);
    expect(avvist.status).toBe(409);
    expect(avvist.body.feil).toMatch(/Elias/);
    expect((await h.get("/api/gjoremal")).body[0].eier.id).toBe(haakon);
  });

  it("forelder kan ikke ta gjøremål, og kan ikke ta fra barna", async () => {
    const f = await agentFor(forelder, "9876");
    const { id } = await nyttGjoremal(f);
    expect((await f.post(`/api/gjoremal/${id}/ta`)).status).toBe(403);
    expect((await f.post(`/api/gjoremal/${id}/fullfor`)).status).toBe(403);
  });

  it("bare eieren kan fullføre, slippe og angre", async () => {
    const f = await agentFor(forelder, "9876");
    const h = await agentFor(haakon, "1234");
    const m = await agentFor(nelly, "5678");
    const { id } = await nyttGjoremal(f);
    await h.post(`/api/gjoremal/${id}/ta`);
    expect((await m.post(`/api/gjoremal/${id}/fullfor`)).status).toBe(403);
    expect((await m.post(`/api/gjoremal/${id}/slipp`)).status).toBe(403);
    expect((await h.post(`/api/gjoremal/${id}/fullfor`)).status).toBe(200);
    expect((await m.post(`/api/gjoremal/${id}/angre`)).status).toBe(403);
    expect((await h.post(`/api/gjoremal/${id}/angre`)).body.status).toBe("tatt");
  });

  it("et barn kan slippe et gjøremål, og da blir det ledig for andre", async () => {
    const f = await agentFor(forelder, "9876");
    const h = await agentFor(haakon, "1234");
    const m = await agentFor(nelly, "5678");
    const { id } = await nyttGjoremal(f);
    await h.post(`/api/gjoremal/${id}/ta`);
    const sluppet = await h.post(`/api/gjoremal/${id}/slipp`);
    expect(sluppet.body).toMatchObject({ status: "ledig", eier: null });
    expect((await m.post(`/api/gjoremal/${id}/ta`)).body.eier.id).toBe(nelly);
  });

  it("man kan ikke slippe et gjøremål som er meldt ferdig, men forelder kan frigjøre det", async () => {
    const f = await agentFor(forelder, "9876");
    const h = await agentFor(haakon, "1234");
    const { id } = await nyttGjoremal(f);
    await h.post(`/api/gjoremal/${id}/ta`);
    await h.post(`/api/gjoremal/${id}/fullfor`);
    expect((await h.post(`/api/gjoremal/${id}/slipp`)).status).toBe(409);
    expect((await f.post(`/api/gjoremal/${id}/slipp`)).body).toMatchObject({
      status: "ledig",
      eier: null,
    });
  });

  it("poeng gis først når forelder godkjenner, og klare poeng vises før det", async () => {
    const f = await agentFor(forelder, "9876");
    const h = await agentFor(haakon, "1234");
    const { id } = await nyttGjoremal(f, "Tømme oppvaskmaskinen", 10);
    await h.post(`/api/gjoremal/${id}/ta`);
    expect((await poengFor(h))[0]).toMatchObject({ poeng: 0, klare: 0 });

    await h.post(`/api/gjoremal/${id}/fullfor`);
    expect((await poengFor(h))[0]).toMatchObject({ poeng: 0, klare: 10 });

    const godkjent = await f.post(`/api/gjoremal/${id}/godkjenn`);
    expect(godkjent.body.status).toBe("godkjent");
    expect((await poengFor(h))[0]).toMatchObject({ poeng: 10, klare: 0 });
  });

  it("barn kan ikke godkjenne, heller ikke sine egne", async () => {
    const f = await agentFor(forelder, "9876");
    const h = await agentFor(haakon, "1234");
    const { id } = await nyttGjoremal(f);
    await h.post(`/api/gjoremal/${id}/ta`);
    await h.post(`/api/gjoremal/${id}/fullfor`);
    expect((await h.post(`/api/gjoremal/${id}/godkjenn`)).status).toBe(403);
    expect((await h.post(`/api/gjoremal/${id}/avvis`)).status).toBe(403);
    expect((await poengFor(h))[0].poeng).toBe(0);
  });

  it("kan ikke godkjenne noe som ikke er meldt ferdig, og aldri to ganger", async () => {
    const f = await agentFor(forelder, "9876");
    const h = await agentFor(haakon, "1234");
    const { id } = await nyttGjoremal(f);
    expect((await f.post(`/api/gjoremal/${id}/godkjenn`)).status).toBe(409);
    await h.post(`/api/gjoremal/${id}/ta`);
    expect((await f.post(`/api/gjoremal/${id}/godkjenn`)).status).toBe(409);
    await h.post(`/api/gjoremal/${id}/fullfor`);
    expect((await f.post(`/api/gjoremal/${id}/godkjenn`)).status).toBe(200);
    expect((await f.post(`/api/gjoremal/${id}/godkjenn`)).status).toBe(409);
    expect((await poengFor(h))[0].poeng).toBe(10);
  });

  it("avvisning gir ingen poeng, og barnet beholder gjøremålet og kan prøve igjen", async () => {
    const f = await agentFor(forelder, "9876");
    const h = await agentFor(haakon, "1234");
    const m = await agentFor(nelly, "5678");
    const { id } = await nyttGjoremal(f);
    await h.post(`/api/gjoremal/${id}/ta`);
    await h.post(`/api/gjoremal/${id}/fullfor`);
    const avvist = await f.post(`/api/gjoremal/${id}/avvis`);
    expect(avvist.body).toMatchObject({ status: "tatt", eier: { id: haakon }, fullfort: null });
    expect((await poengFor(h))[0]).toMatchObject({ poeng: 0, klare: 0 });
    expect((await m.post(`/api/gjoremal/${id}/ta`)).status).toBe(409);
    expect((await h.post(`/api/gjoremal/${id}/fullfor`)).status).toBe(200);
    await f.post(`/api/gjoremal/${id}/godkjenn`);
    expect((await poengFor(h))[0].poeng).toBe(10);
  });

  it("poeng summeres over flere gjøremål, per barn", async () => {
    const f = await agentFor(forelder, "9876");
    const h = await agentFor(haakon, "1234");
    const m = await agentFor(nelly, "5678");
    const a = await nyttGjoremal(f, "A", 10);
    const b = await nyttGjoremal(f, "B", 5);
    const c = await nyttGjoremal(f, "C", 7);
    await h.post(`/api/gjoremal/${a.id}/ta`);
    await h.post(`/api/gjoremal/${b.id}/ta`);
    await m.post(`/api/gjoremal/${c.id}/ta`);
    for (const g of [a, b]) await h.post(`/api/gjoremal/${g.id}/fullfor`);
    await m.post(`/api/gjoremal/${c.id}/fullfor`);
    await f.post(`/api/gjoremal/${a.id}/godkjenn`);

    expect((await poengFor(h))[0]).toMatchObject({ poeng: 10, klare: 5 });
    expect((await poengFor(m))[0]).toMatchObject({ poeng: 0, klare: 7 });
  });

  it("barn ser bare sin egen saldo, forelder ser alle barna", async () => {
    const f = await agentFor(forelder, "9876");
    const h = await agentFor(haakon, "1234");
    const egen = await poengFor(h);
    expect(egen).toHaveLength(1);
    expect(egen[0].bruker.id).toBe(haakon);
    const alle = await poengFor(f);
    expect(alle.map((p: { bruker: { id: number } }) => p.bruker.id).sort()).toEqual(
      [haakon, nelly].sort(),
    );
  });

  it("et gjøremål med 0 poeng kan godkjennes uten å lage poengrad", async () => {
    const f = await agentFor(forelder, "9876");
    const h = await agentFor(haakon, "1234");
    const { id } = await nyttGjoremal(f, "Bare for gøy", 0);
    await h.post(`/api/gjoremal/${id}/ta`);
    await h.post(`/api/gjoremal/${id}/fullfor`);
    expect((await f.post(`/api/gjoremal/${id}/godkjenn`)).status).toBe(200);
    const rader = db.prepare("SELECT COUNT(*) AS n FROM poeng_logg").get() as { n: number };
    expect(rader.n).toBe(0);
  });

  it("endring av poeng mens gjøremålet venter gjelder ved godkjenning, men godkjente kan ikke endres", async () => {
    const f = await agentFor(forelder, "9876");
    const h = await agentFor(haakon, "1234");
    const { id } = await nyttGjoremal(f, "Vaske bilen", 10);
    await h.post(`/api/gjoremal/${id}/ta`);
    await h.post(`/api/gjoremal/${id}/fullfor`);
    await f.patch(`/api/gjoremal/${id}`).send({ poeng: 25 });
    expect((await poengFor(h))[0].klare).toBe(25);
    await f.post(`/api/gjoremal/${id}/godkjenn`);
    expect((await poengFor(h))[0].poeng).toBe(25);
    expect((await f.patch(`/api/gjoremal/${id}`).send({ poeng: 1 })).status).toBe(409);
  });

  it("poengene blir stående selv om gjøremålet slettes", async () => {
    const f = await agentFor(forelder, "9876");
    const h = await agentFor(haakon, "1234");
    const { id } = await nyttGjoremal(f, "Rydde garasjen", 20);
    await h.post(`/api/gjoremal/${id}/ta`);
    await h.post(`/api/gjoremal/${id}/fullfor`);
    await f.post(`/api/gjoremal/${id}/godkjenn`);
    expect((await f.delete(`/api/gjoremal/${id}`)).status).toBe(204);
    expect((await poengFor(h))[0].poeng).toBe(20);
    const rad = db.prepare("SELECT grunn, gjoremal_id FROM poeng_logg").get() as {
      grunn: string;
      gjoremal_id: number | null;
    };
    expect(rad).toEqual({ grunn: "Rydde garasjen", gjoremal_id: null });
  });

  it("sletting av et gjøremål som venter gir ikke poeng", async () => {
    const f = await agentFor(forelder, "9876");
    const h = await agentFor(haakon, "1234");
    const { id } = await nyttGjoremal(f);
    await h.post(`/api/gjoremal/${id}/ta`);
    await h.post(`/api/gjoremal/${id}/fullfor`);
    await f.delete(`/api/gjoremal/${id}`);
    expect((await poengFor(h))[0]).toMatchObject({ poeng: 0, klare: 0 });
  });

  it("gir 404 for gjøremål som ikke finnes", async () => {
    const f = await agentFor(forelder, "9876");
    const h = await agentFor(haakon, "1234");
    expect((await h.post("/api/gjoremal/999/ta")).status).toBe(404);
    expect((await f.post("/api/gjoremal/999/godkjenn")).status).toBe(404);
    expect((await f.delete("/api/gjoremal/999")).status).toBe(404);
  });

  it("alle trinn logges i revisjonsloggen", async () => {
    const f = await agentFor(forelder, "9876");
    const h = await agentFor(haakon, "1234");
    const { id } = await nyttGjoremal(f);
    await h.post(`/api/gjoremal/${id}/ta`);
    await h.post(`/api/gjoremal/${id}/fullfor`);
    await f.post(`/api/gjoremal/${id}/godkjenn`);
    const logg = db
      .prepare(
        "SELECT handling, user_id FROM audit_log WHERE handling LIKE 'gjoremal_%' ORDER BY id",
      )
      .all() as { handling: string; user_id: number }[];
    expect(logg).toEqual([
      { handling: "gjoremal_opprettet", user_id: forelder },
      { handling: "gjoremal_tatt", user_id: haakon },
      { handling: "gjoremal_fullfort", user_id: haakon },
      { handling: "gjoremal_godkjent", user_id: forelder },
    ]);
  });

  it("de 20 siste godkjente vises, men alle åpne gjøremål er med", async () => {
    const f = await agentFor(forelder, "9876");
    const h = await agentFor(haakon, "1234");
    for (let i = 0; i < 22; i++) {
      const { id } = await nyttGjoremal(f, `Oppgave ${i}`, 1);
      await h.post(`/api/gjoremal/${id}/ta`);
      await h.post(`/api/gjoremal/${id}/fullfor`);
      await f.post(`/api/gjoremal/${id}/godkjenn`);
    }
    await nyttGjoremal(f, "Åpen", 1);
    const liste = (await h.get("/api/gjoremal")).body as { status: string }[];
    expect(liste.filter((g) => g.status === "godkjent")).toHaveLength(20);
    expect(liste.filter((g) => g.status === "ledig")).toHaveLength(1);
    expect((await poengFor(h))[0].poeng).toBe(22);
  });
});
