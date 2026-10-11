import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import {
  dagerMellom,
  erDato,
  erTidspunkt,
  leggTilDager,
  leggTilMinutter,
} from "../src/core/dato.js";
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
type Agent = Awaited<ReturnType<typeof agentFor>>;

const avtale = (kalenderId: number, extra: Record<string, unknown> = {}) => ({
  kalenderId,
  tittel: "Fotballtrening",
  helDag: false,
  start: "2026-10-12T17:00",
  slutt: "2026-10-12T18:30",
  ...extra,
});

const hent = async (a: Agent, fra: string, til: string) =>
  (await a.get(`/api/kalender/hendelser?fra=${fra}&til=${til}`)).body as {
    id: number;
    tittel: string;
    start: string;
    slutt: string;
    helDag: boolean;
  }[];

describe("datohjelpere", () => {
  it("validerer datoer og tidspunkt", () => {
    expect(erDato("2026-10-12")).toBe(true);
    expect(erDato("2026-02-30")).toBe(false);
    expect(erDato("2026-13-01")).toBe(false);
    expect(erDato("12.10.2026")).toBe(false);
    expect(erTidspunkt("2026-10-12T17:00")).toBe(true);
    expect(erTidspunkt("2026-10-12T24:00")).toBe(false);
    expect(erTidspunkt("2026-10-12T17:60")).toBe(false);
    expect(erTidspunkt("2026-10-12")).toBe(false);
  });

  it("regner med dager og minutter over måned, år og sommertid", () => {
    expect(leggTilDager("2026-10-31", 1)).toBe("2026-11-01");
    expect(leggTilDager("2026-12-31", 1)).toBe("2027-01-01");
    expect(leggTilDager("2026-03-01", -1)).toBe("2026-02-28");
    expect(leggTilMinutter("2026-10-12T23:30", 60)).toBe("2026-10-13T00:30");
    expect(dagerMellom("2026-10-24", "2026-10-26")).toBe(2);
    expect(dagerMellom("2026-03-28", "2026-03-30")).toBe(2);
  });
});

describe("kalendere", () => {
  it("krever innlogging", async () => {
    expect((await request(app).get("/api/kalender/kalendere")).status).toBe(401);
    expect(
      (await request(app).get("/api/kalender/hendelser?fra=2026-10-01&til=2026-11-01")).status,
    ).toBe(401);
    expect((await request(app).post("/api/kalender/hendelser").send({})).status).toBe(401);
  });

  it("det finnes en standardkalender, og alle kan se kalenderne", async () => {
    const h = await agentFor(haakon, "1234");
    const res = await h.get("/api/kalender/kalendere");
    expect(res.body).toEqual([{ id: 1, navn: "Familie", farge: "#4f8cff", kilde: "manuell" }]);
  });

  it("bare voksne kan lage, endre og slette kalendere", async () => {
    const f = await agentFor(forelder, "9876");
    const h = await agentFor(haakon, "1234");
    expect((await h.post("/api/kalender/kalendere").send({ navn: "Fusk" })).status).toBe(403);
    const ny = await f
      .post("/api/kalender/kalendere")
      .send({ navn: "Elias fotball", farge: "#2fb67c" });
    expect(ny.status).toBe(201);
    expect(ny.body).toMatchObject({ navn: "Elias fotball", farge: "#2fb67c", kilde: "manuell" });
    expect(
      (await h.patch(`/api/kalender/kalendere/${ny.body.id}`).send({ navn: "x" })).status,
    ).toBe(403);
    expect((await h.delete(`/api/kalender/kalendere/${ny.body.id}`)).status).toBe(403);
    const endret = await f
      .patch(`/api/kalender/kalendere/${ny.body.id}`)
      .send({ farge: "#a56bff" });
    expect(endret.body).toMatchObject({ navn: "Elias fotball", farge: "#a56bff" });
    expect((await f.delete(`/api/kalender/kalendere/${ny.body.id}`)).status).toBe(204);
    expect((await f.get("/api/kalender/kalendere")).body).toHaveLength(1);
  });

  it("validerer navn og farge, og fargen kan velges fritt", async () => {
    const f = await agentFor(forelder, "9876");
    expect((await f.post("/api/kalender/kalendere").send({ navn: "  " })).status).toBe(400);
    expect((await f.post("/api/kalender/kalendere").send({ navn: "x", farge: "rød" })).status).toBe(
      400,
    );
    expect(
      (await f.post("/api/kalender/kalendere").send({ navn: "x", farge: "#12AbEf" })).status,
    ).toBe(201);
    const uten = await f.post("/api/kalender/kalendere").send({ navn: "Uten farge" });
    expect(uten.body.farge).toBe("#4f8cff");
  });

  it("sletting av en kalender tar med avtalene i den, men ikke andre", async () => {
    const f = await agentFor(forelder, "9876");
    const ny = (await f.post("/api/kalender/kalendere").send({ navn: "Midlertidig" })).body;
    await f.post("/api/kalender/hendelser").send(avtale(ny.id, { tittel: "Skal bort" }));
    await f.post("/api/kalender/hendelser").send(avtale(1, { tittel: "Blir" }));
    await f.delete(`/api/kalender/kalendere/${ny.id}`);
    expect((await hent(f, "2026-10-01", "2026-11-01")).map((e) => e.tittel)).toEqual(["Blir"]);
  });
});

describe("avtaler", () => {
  it("bare voksne kan legge inn, endre og slette, men barn kan se", async () => {
    const f = await agentFor(forelder, "9876");
    const h = await agentFor(haakon, "1234");
    expect((await h.post("/api/kalender/hendelser").send(avtale(1))).status).toBe(403);
    const ny = await f.post("/api/kalender/hendelser").send(avtale(1, { sted: "Idrettsparken" }));
    expect(ny.status).toBe(201);
    expect(ny.body).toMatchObject({
      kalenderId: 1,
      tittel: "Fotballtrening",
      start: "2026-10-12T17:00",
      slutt: "2026-10-12T18:30",
      helDag: false,
      sted: "Idrettsparken",
      kilde: "manuell",
    });
    expect((await hent(h, "2026-10-12", "2026-10-13"))[0]!.tittel).toBe("Fotballtrening");
    expect((await h.put(`/api/kalender/hendelser/${ny.body.id}`).send(avtale(1))).status).toBe(403);
    expect((await h.delete(`/api/kalender/hendelser/${ny.body.id}`)).status).toBe(403);
    expect(await hent(h, "2026-10-12", "2026-10-13")).toHaveLength(1);
  });

  it("uten sluttid varer en avtale én time", async () => {
    const f = await agentFor(forelder, "9876");
    const res = await f.post("/api/kalender/hendelser").send(avtale(1, { slutt: null }));
    expect(res.body.slutt).toBe("2026-10-12T18:00");
  });

  it("en hel-dag-avtale går fra midnatt til midnatt, og kan vare flere dager", async () => {
    const f = await agentFor(forelder, "9876");
    const en = await f
      .post("/api/kalender/hendelser")
      .send({ kalenderId: 1, tittel: "Fridag", helDag: true, start: "2026-10-12" });
    expect(en.body).toMatchObject({
      start: "2026-10-12T00:00",
      slutt: "2026-10-13T00:00",
      helDag: true,
    });
    const flere = await f.post("/api/kalender/hendelser").send({
      kalenderId: 1,
      tittel: "Ferie",
      helDag: true,
      start: "2026-10-30",
      slutt: "2026-11-02",
    });
    expect(flere.body).toMatchObject({ start: "2026-10-30T00:00", slutt: "2026-11-03T00:00" });
  });

  it("finner avtaler som overlapper tidsrommet, også de som starter før og slutter etter", async () => {
    const f = await agentFor(forelder, "9876");
    await f.post("/api/kalender/hendelser").send({
      kalenderId: 1,
      tittel: "Ferie",
      helDag: true,
      start: "2026-10-10",
      slutt: "2026-10-20",
    });
    await f
      .post("/api/kalender/hendelser")
      .send(avtale(1, { tittel: "Kveld", start: "2026-10-12T23:00", slutt: "2026-10-13T01:00" }));
    await f
      .post("/api/kalender/hendelser")
      .send({ kalenderId: 1, tittel: "I går", helDag: true, start: "2026-10-11" });
    const dag = (d: string, e: string) => hent(f, d, e).then((r) => r.map((x) => x.tittel));
    expect(await dag("2026-10-13", "2026-10-14")).toEqual(["Ferie", "Kveld"]);
    expect(await dag("2026-10-12", "2026-10-13")).toEqual(["Ferie", "Kveld"]);
    expect(await dag("2026-10-11", "2026-10-12")).toEqual(["Ferie", "I går"]);
    expect(await dag("2026-10-20", "2026-10-21")).toEqual(["Ferie"]);
    expect(await dag("2026-10-21", "2026-10-22")).toEqual([]);
    expect(await dag("2026-10-01", "2026-10-10")).toEqual([]);
  });

  it("en avtale som slutter ved midnatt vises ikke dagen etter", async () => {
    const f = await agentFor(forelder, "9876");
    await f
      .post("/api/kalender/hendelser")
      .send({ kalenderId: 1, tittel: "Én dag", helDag: true, start: "2026-10-12" });
    expect(await hent(f, "2026-10-13", "2026-10-14")).toEqual([]);
  });

  it("endrer en avtale, også til en annen kalender, og sletter den", async () => {
    const f = await agentFor(forelder, "9876");
    const k2 = (await f.post("/api/kalender/kalendere").send({ navn: "Jobb" })).body;
    const { id } = (await f.post("/api/kalender/hendelser").send(avtale(1))).body;
    const endret = await f
      .put(`/api/kalender/hendelser/${id}`)
      .send(avtale(k2.id, { tittel: "Møte", helDag: true, start: "2026-10-14", slutt: null }));
    expect(endret.body).toMatchObject({
      kalenderId: k2.id,
      tittel: "Møte",
      helDag: true,
      start: "2026-10-14T00:00",
      slutt: "2026-10-15T00:00",
    });
    expect(await hent(f, "2026-10-12", "2026-10-13")).toEqual([]);
    expect((await f.delete(`/api/kalender/hendelser/${id}`)).status).toBe(204);
    expect(await hent(f, "2026-10-01", "2026-11-01")).toEqual([]);
  });

  it("avviser ugyldige tider og felt", async () => {
    const f = await agentFor(forelder, "9876");
    const prøv = async (extra: Record<string, unknown>) =>
      (await f.post("/api/kalender/hendelser").send(avtale(1, extra))).status;
    expect(await prøv({ start: "2026-10-12" })).toBe(400);
    expect(await prøv({ start: "i morgen" })).toBe(400);
    expect(await prøv({ start: "2026-10-12T25:00" })).toBe(400);
    expect(await prøv({ slutt: "2026-10-12T16:00" })).toBe(400);
    expect(await prøv({ slutt: "2026-10-12T17:00" })).toBe(400);
    expect(await prøv({ helDag: true, start: "2026-10-12T17:00" })).toBe(400);
    expect(await prøv({ helDag: true, start: "2026-10-12", slutt: "2026-10-10" })).toBe(400);
    expect(await prøv({ tittel: "  " })).toBe(400);
    expect(await prøv({ tittel: "x".repeat(81) })).toBe(400);
    expect(await prøv({ kalenderId: 999 })).toBe(404);
  });

  it("validerer søket etter avtaler", async () => {
    const f = await agentFor(forelder, "9876");
    const status = async (q: string) => (await f.get(`/api/kalender/hendelser${q}`)).status;
    expect(await status("")).toBe(400);
    expect(await status("?fra=2026-10-01")).toBe(400);
    expect(await status("?fra=2026-10-32&til=2026-11-01")).toBe(400);
    expect(await status("?fra=2026-11-01&til=2026-10-01")).toBe(400);
    expect(await status("?fra=2026-10-01&til=2026-10-01")).toBe(400);
    expect(await status("?fra=2024-01-01&til=2026-01-01")).toBe(400);
    expect(await status("?fra=2026-10-01&til=2026-11-01")).toBe(200);
  });

  it("gir 404 for avtaler og kalendere som ikke finnes", async () => {
    const f = await agentFor(forelder, "9876");
    expect((await f.put("/api/kalender/hendelser/999").send(avtale(1))).status).toBe(404);
    expect((await f.delete("/api/kalender/hendelser/999")).status).toBe(404);
    expect((await f.patch("/api/kalender/kalendere/999").send({ navn: "x" })).status).toBe(404);
    expect((await f.delete("/api/kalender/kalendere/999")).status).toBe(404);
  });

  it("er klar for kalendere utenfra: en Spond-kalender kan ikke endres for hånd, men vises som alle andre", async () => {
    const f = await agentFor(forelder, "9876");
    const h = await agentFor(haakon, "1234");
    db.prepare(
      "INSERT INTO kalendere (id, navn, farge, kilde, ekstern_id) VALUES (50, 'Spond: G10', '#e8579a', 'spond', 'abc')",
    ).run();
    db.prepare(
      `INSERT INTO events (id, kalender_id, tittel, start, slutt, hel_dag, kilde, ekstern_id)
       VALUES (500, 50, 'Kamp', '2026-10-12T10:00', '2026-10-12T11:30', 0, 'spond', 'ev-1')`,
    ).run();
    expect((await hent(h, "2026-10-12", "2026-10-13"))[0]!.tittel).toBe("Kamp");
    expect((await f.post("/api/kalender/hendelser").send(avtale(50))).status).toBe(409);
    expect((await f.put("/api/kalender/hendelser/500").send(avtale(1))).status).toBe(409);
    expect((await f.delete("/api/kalender/hendelser/500")).status).toBe(409);
    expect(await hent(f, "2026-10-12", "2026-10-13")).toHaveLength(1);
  });

  it("gjøremål har plass til en frist, uten at noe annet endres", async () => {
    const kolonner = db.prepare("PRAGMA table_info(gjoremal)").all() as { name: string }[];
    expect(kolonner.map((k) => k.name)).toContain("frist");
  });

  it("alle trinn logges", async () => {
    const f = await agentFor(forelder, "9876");
    const { id } = (await f.post("/api/kalender/hendelser").send(avtale(1))).body;
    await f.put(`/api/kalender/hendelser/${id}`).send(avtale(1, { tittel: "Endret" }));
    await f.delete(`/api/kalender/hendelser/${id}`);
    const logg = db
      .prepare("SELECT handling FROM audit_log WHERE handling LIKE 'avtale_%' ORDER BY id")
      .all() as { handling: string }[];
    expect(logg.map((l) => l.handling)).toEqual([
      "avtale_opprettet",
      "avtale_endret",
      "avtale_slettet",
    ]);
  });
});
