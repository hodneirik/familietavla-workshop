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
let naa = Date.parse("2026-10-07T10:00:00Z");

beforeEach(() => {
  naa = Date.parse("2026-10-07T10:00:00Z");
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
});

async function agentFor(userId: number, pin: string) {
  const agent = request.agent(app);
  expect((await agent.post("/api/auth/login").send({ userId, pin })).status).toBe(200);
  return agent;
}
type Agent = Awaited<ReturnType<typeof agentFor>>;

const lag = async (f: Agent, data: object = {}) =>
  f
    .post("/api/lekser")
    .send({ barnIder: [haakon], tittel: "Les kapittel 3", frist: "2026-10-09", ...data });

describe("lekser: tilgang", () => {
  it("krever innlogging", async () => {
    expect((await request(app).get("/api/lekser")).status).toBe(401);
    expect((await request(app).post("/api/lekser").send({})).status).toBe(401);
    expect((await request(app).post("/api/lekser/1/gjort")).status).toBe(401);
  });

  it("bare foreldre legger inn, endrer og sletter", async () => {
    const f = await agentFor(forelder, "9876");
    const h = await agentFor(haakon, "1234");
    expect((await lag(h)).status).toBe(403);
    const id = (await lag(f)).body[0].id as number;
    expect((await h.patch(`/api/lekser/${id}`).send({ tittel: "Annet" })).status).toBe(403);
    expect((await h.delete(`/api/lekser/${id}`)).status).toBe(403);
    expect(
      (await f.patch(`/api/lekser/${id}`).send({ tittel: "Annet", fag: "Norsk" })).body,
    ).toMatchObject({
      tittel: "Annet",
      fag: "Norsk",
    });
    const med = await f
      .patch(`/api/lekser/${id}`)
      .send({ fritekst: "  Husk å ta med boka.\nSe side 4.  " });
    expect(med.body).toMatchObject({
      tittel: "Annet",
      fritekst: "Husk å ta med boka.\nSe side 4.",
    });
    expect((await f.patch(`/api/lekser/${id}`).send({ fritekst: "" })).body.fritekst).toBeNull();
    expect((await f.patch(`/api/lekser/${id}`).send({ fritekst: "x".repeat(1001) })).status).toBe(
      400,
    );
    expect((await f.delete(`/api/lekser/${id}`)).status).toBe(204);
    expect((await f.delete(`/api/lekser/${id}`)).status).toBe(404);
  });
});

describe("lekser: opprettelse", () => {
  it("lager én lekse per barn, og avviser voksne, ukjente og ugyldige datoer", async () => {
    const f = await agentFor(forelder, "9876");
    const res = await lag(f, { barnIder: [haakon, nelly, haakon], fag: " Matte " });
    expect(res.status).toBe(201);
    expect(res.body).toHaveLength(2);
    expect(res.body.map((l: { barn: { id: number } }) => l.barn.id).sort()).toEqual(
      [haakon, nelly].sort(),
    );
    expect(res.body[0]).toMatchObject({ fag: "Matte", gjort: false, fritekst: null });
    const fri = await lag(f, { fritekst: "Del 1 og 2.\nSpør Nelly om hjelp." });
    expect(fri.body[0].fritekst).toBe("Del 1 og 2.\nSpør Nelly om hjelp.");
    expect((await lag(f, { barnIder: [forelder] })).status).toBe(400);
    expect((await lag(f, { barnIder: [999] })).status).toBe(400);
    expect((await lag(f, { frist: "2026-13-40" })).status).toBe(400);
    expect((await lag(f, { tittel: "  " })).status).toBe(400);
    expect((await lag(f, { barnIder: [] })).status).toBe(400);
  });

  it("legger ikke inn noe hvis ett av barna er ugyldig", async () => {
    const f = await agentFor(forelder, "9876");
    expect((await lag(f, { barnIder: [haakon, forelder] })).status).toBe(400);
    expect((await f.get("/api/lekser")).body).toEqual([]);
  });
});

describe("lekser: liste og avkrysning", () => {
  it("barn ser bare sine egne, og voksne ser alle", async () => {
    const f = await agentFor(forelder, "9876");
    const h = await agentFor(haakon, "1234");
    const m = await agentFor(nelly, "5678");
    await lag(f, { tittel: "Til Elias" });
    await lag(f, { barnIder: [nelly], tittel: "Til Nelly" });
    expect((await h.get("/api/lekser")).body.map((l: { tittel: string }) => l.tittel)).toEqual([
      "Til Elias",
    ]);
    expect((await m.get("/api/lekser")).body.map((l: { tittel: string }) => l.tittel)).toEqual([
      "Til Nelly",
    ]);
    expect((await f.get("/api/lekser")).body).toHaveLength(2);
  });

  it("barnet krysser av og angrer sin egen, men ikke andres", async () => {
    const f = await agentFor(forelder, "9876");
    const h = await agentFor(haakon, "1234");
    const m = await agentFor(nelly, "5678");
    const id = (await lag(f)).body[0].id as number;
    expect((await m.post(`/api/lekser/${id}/gjort`)).status).toBe(403);
    expect((await m.post(`/api/lekser/${id}/ugjort`)).status).toBe(403);
    expect((await h.post(`/api/lekser/${id}/gjort`)).body.gjort).toBe(true);
    expect((await h.post(`/api/lekser/${id}/gjort`)).body.gjort).toBe(true);
    expect((await h.post(`/api/lekser/${id}/ugjort`)).body.gjort).toBe(false);
    expect((await h.post("/api/lekser/999/gjort")).status).toBe(404);
  });

  it("voksne kan krysse av for barna", async () => {
    const f = await agentFor(forelder, "9876");
    const id = (await lag(f)).body[0].id as number;
    expect((await f.post(`/api/lekser/${id}/gjort`)).body.gjort).toBe(true);
    const rad = db.prepare("SELECT gjort_av FROM lekser WHERE id = ?").get(id) as {
      gjort_av: number;
    };
    expect(rad.gjort_av).toBe(forelder);
  });

  it("gjorte lekser forsvinner etter to uker, men det som ikke er gjort blir stående", async () => {
    const f = await agentFor(forelder, "9876");
    const gammel = (await lag(f, { tittel: "Gammel gjort", frist: "2026-09-20" })).body[0]
      .id as number;
    await lag(f, { tittel: "Gammel ugjort", frist: "2026-09-20" });
    await lag(f, { tittel: "Ny", frist: "2026-10-08" });
    await f.post(`/api/lekser/${gammel}/gjort`);
    const titler = (await f.get("/api/lekser")).body.map((l: { tittel: string }) => l.tittel);
    expect(titler).toEqual(["Gammel ugjort", "Ny"]);
  });

  it("sorterer på samme frist etter barnets navn", async () => {
    const f = await agentFor(forelder, "9876");
    await lag(f, { barnIder: [nelly, haakon], tittel: "Lese", frist: "2026-10-09" });
    await lag(f, { barnIder: [nelly, haakon], tittel: "Skrive", frist: "2026-10-08" });
    const liste = (await f.get("/api/lekser")).body as {
      tittel: string;
      barn: { visningsnavn: string };
    }[];
    expect(liste.map((l) => `${l.tittel} ${l.barn.visningsnavn}`)).toEqual([
      "Skrive Elias",
      "Skrive Nelly",
      "Lese Elias",
      "Lese Nelly",
    ]);
  });

  it("sorterer etter frist", async () => {
    const f = await agentFor(forelder, "9876");
    await lag(f, { tittel: "B", frist: "2026-10-12" });
    await lag(f, { tittel: "A", frist: "2026-10-08" });
    expect((await f.get("/api/lekser")).body.map((l: { tittel: string }) => l.tittel)).toEqual([
      "A",
      "B",
    ]);
  });
});
