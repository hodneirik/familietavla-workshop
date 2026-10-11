import { copyFileSync, mkdirSync, mkdtempSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { loadConfig } from "../src/config.js";
import { createLogger } from "../src/core/logger.js";
import { openDb, type Db } from "../src/db/client.js";
import { migrate, migrationsDir } from "../src/db/migrate.js";
import { createUser } from "../src/modules/users/service.js";

let db: Db;
let app: ReturnType<typeof createApp>;
let forelder: number;
let haakon: number;
let besteforeldre: number;
const naa = Date.parse("2026-10-07T10:00:00Z");

beforeEach(() => {
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
  besteforeldre = createUser(
    db,
    { visningsnavn: "Farmor og farfar", rolle: "besteforelder", pin: "4321" },
    null,
  ).id;
});

async function agentFor(userId: number, pin: string) {
  const agent = request.agent(app);
  expect((await agent.post("/api/auth/login").send({ userId, pin })).status).toBe(200);
  return agent;
}
type Agent = Awaited<ReturnType<typeof agentFor>>;
const somBesteforeldre = () => agentFor(besteforeldre, "4321");
const somForelder = () => agentFor(forelder, "9876");
const somHaakon = () => agentFor(haakon, "1234");

describe("besteforeldre: ombygging av users", () => {
  it("beholder brukere, økter og utenlandsnøkler når tabellen bygges om", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "mig-"));
    const gamle = readdirSync(migrationsDir).filter((f) => f < "011");
    for (const f of gamle) copyFileSync(path.join(migrationsDir, f), path.join(dir, f));
    const gammel = openDb(":memory:");
    migrate(gammel, dir);
    const bruker = createUser(
      gammel,
      { visningsnavn: "Anita", rolle: "forelder", pin: "9876" },
      null,
    );
    const barn = createUser(gammel, { visningsnavn: "Elias", rolle: "barn", pin: "1234" }, null);
    gammel
      .prepare("INSERT INTO gjoremal (tittel, poeng, opprettet_av) VALUES ('Støvsuge', 5, ?)")
      .run(bruker.id);
    gammel
      .prepare("INSERT INTO poeng_logg (user_id, poeng, grunn) VALUES (?, 5, 'Støvsuge')")
      .run(barn.id);
    expect(() =>
      gammel
        .prepare("INSERT INTO users (visningsnavn, rolle) VALUES ('Bestemor', 'besteforelder')")
        .run(),
    ).toThrow();

    mkdirSync(dir, { recursive: true });
    copyFileSync(
      path.join(migrationsDir, "011_besteforeldre.sql"),
      path.join(dir, "011_besteforeldre.sql"),
    );
    expect(migrate(gammel, dir)).toEqual(["011_besteforeldre.sql"]);

    const brukere = gammel.prepare("SELECT id, visningsnavn, rolle FROM users ORDER BY id").all();
    expect(brukere).toEqual([
      { id: bruker.id, visningsnavn: "Anita", rolle: "forelder" },
      { id: barn.id, visningsnavn: "Elias", rolle: "barn" },
    ]);
    expect(gammel.prepare("PRAGMA foreign_key_check").all()).toEqual([]);
    expect(
      (gammel.prepare("PRAGMA foreign_keys").get() as { foreign_keys: number }).foreign_keys,
    ).toBe(1);
    // De nye brukerne får fortsatt nye id-er, og referansene fra andre tabeller virker
    const ny = createUser(
      gammel,
      { visningsnavn: "Farmor", rolle: "besteforelder", pin: "4321" },
      null,
    );
    expect(ny.id).toBeGreaterThan(barn.id);
    expect(gammel.prepare("SELECT COUNT(*) AS n FROM gjoremal").get()).toEqual({ n: 1 });
    // Utenlandsnøklene virker igjen: en bruker med poeng kan ikke slettes
    expect(() => gammel.prepare("DELETE FROM users WHERE id = ?").run(barn.id)).toThrow(
      /FOREIGN KEY/,
    );
  });
});

describe("besteforeldre: bare lesing", () => {
  it("foreldre kan opprette en besteforelder, og barn ikke", async () => {
    const f = await somForelder();
    const res = await f
      .post("/api/users")
      .send({ visningsnavn: "Bestemor", rolle: "besteforelder", pin: "1111" });
    expect(res.status).toBe(201);
    expect(res.body.rolle).toBe("besteforelder");
    expect(
      (await f.post("/api/users").send({ visningsnavn: "X", rolle: "gammel", pin: "2222" })).status,
    ).toBe(400);
    expect(
      (
        await (
          await somHaakon()
        )
          .post("/api/users")
          .send({ visningsnavn: "X", rolle: "barn", pin: "2222" })
      ).status,
    ).toBe(403);
  });

  it("kan se det som står på Hjem", async () => {
    const b = await somBesteforeldre();
    for (const sti of [
      "/api/oppslag",
      "/api/gjoremal",
      "/api/gjoremal/poeng",
      "/api/kalender/kalendere",
      "/api/kalender/hendelser?fra=2026-10-07&til=2026-10-14",
      "/api/middag?fra=2026-10-07&til=2026-10-14",
      "/api/lekser",
      "/api/auth/me",
    ]) {
      expect((await b.get(sti)).status, sti).toBe(200);
    }
  });

  it("får ikke se handlelista, brukerne eller endre noe annet", async () => {
    const f = await somForelder();
    const b = await somBesteforeldre();
    const lekse = await f
      .post("/api/lekser")
      .send({ barnIder: [haakon], tittel: "Lese", frist: "2026-10-09" });
    expect((await b.get("/api/handleliste")).status).toBe(403);
    expect((await b.post("/api/handleliste").send({ navn: "Melk" })).status).toBe(403);
    expect((await b.get("/api/users")).status).toBe(403);
    expect(
      (await b.post("/api/kalender/kalendere").send({ navn: "X", farge: "#889cb0" })).status,
    ).toBe(403);
    expect(
      (
        await b.post("/api/kalender/hendelser").send({
          kalenderId: 1,
          tittel: "X",
          start: "2026-10-08T10:00",
          slutt: "2026-10-08T11:00",
          helDag: false,
        })
      ).status,
    ).toBe(403);
    expect((await b.put("/api/middag/2026-10-07").send({ rettId: 1 })).status).toBe(403);
    expect((await b.put("/api/middag/2026-10-07/stjerner").send({ stjerner: 5 })).status).toBe(403);
    expect(
      (await b.post("/api/middag/retter").send({ tittel: "X", ingredienser: [] })).status,
    ).toBe(403);
    expect(
      (await b.post("/api/lekser").send({ barnIder: [haakon], tittel: "X", frist: "2026-10-09" }))
        .status,
    ).toBe(403);
    expect((await b.post(`/api/lekser/${lekse.body[0].id}/gjort`)).status).toBe(403);
    expect((await b.patch(`/api/lekser/${lekse.body[0].id}`).send({ tittel: "X" })).status).toBe(
      403,
    );
    expect((await b.delete(`/api/lekser/${lekse.body[0].id}`)).status).toBe(403);
  });

  it("har ikke Middag-fanen: rettene er stengt, men planen for dagene er åpen", async () => {
    const f = await somForelder();
    await f
      .post("/api/middag/retter")
      .send({ tittel: "Taco", notat: "Hemmelig", ingredienser: ["lomper"] });
    const b = await somBesteforeldre();
    expect((await b.get("/api/middag/retter")).status).toBe(403);
    expect((await b.get("/api/middag?fra=2026-10-07&til=2026-10-14")).status).toBe(200);
  });

  it("kan bytte sin egen PIN og emoji", async () => {
    const b = await somBesteforeldre();
    const me = await b.get("/api/auth/me");
    expect(me.body.bruker.rolle).toBe("besteforelder");
    expect((await b.patch("/api/auth/me").send({ emoji: "👵" })).status).toBe(200);
  });
});

describe("besteforeldre: gjøremål", () => {
  const lag = (a: Agent, data: object = {}) =>
    a.post("/api/gjoremal").send({ tittel: "Klippe plenen", poeng: 20, ...data });

  async function venter(egen: Agent, tittel = "Klippe plenen") {
    const id = (await lag(egen, { tittel })).body.id as number;
    const h = await somHaakon();
    await h.post(`/api/gjoremal/${id}/ta`);
    await h.post(`/api/gjoremal/${id}/fullfor`);
    return id;
  }

  it("kan lage gjøremål med høyst 30 poeng, og barn kan ikke", async () => {
    const b = await somBesteforeldre();
    const ok = await lag(b, { poeng: 30 });
    expect(ok.status).toBe(201);
    expect(ok.body.opprettetAv).toBe(besteforeldre);
    expect((await lag(b, { poeng: 31 })).status).toBe(400);
    expect((await lag(await somHaakon())).status).toBe(403);
    // Foreldre har fortsatt ingen grense
    expect((await lag(await somForelder(), { poeng: 500 })).status).toBe(201);
  });

  it("kan endre og slette sine egne, men ikke andres", async () => {
    const f = await somForelder();
    const b = await somBesteforeldre();
    const egen = (await lag(b)).body.id as number;
    const andres = (await lag(f)).body.id as number;
    expect(
      (await b.patch(`/api/gjoremal/${egen}`).send({ tittel: "Raking", poeng: 15 })).body,
    ).toMatchObject({
      tittel: "Raking",
      poeng: 15,
    });
    expect((await b.patch(`/api/gjoremal/${egen}`).send({ poeng: 31 })).status).toBe(400);
    expect((await b.patch(`/api/gjoremal/${andres}`).send({ tittel: "X" })).status).toBe(403);
    expect((await b.delete(`/api/gjoremal/${andres}`)).status).toBe(403);
    expect((await b.delete(`/api/gjoremal/${egen}`)).status).toBe(204);
  });

  it("godkjenner sine egne, og poengene går til barnet", async () => {
    const b = await somBesteforeldre();
    const id = await venter(b);
    const res = await b.post(`/api/gjoremal/${id}/godkjenn`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("godkjent");
    const poeng = (await (await somHaakon()).get("/api/gjoremal/poeng")).body;
    expect(poeng[0].poeng).toBe(20);
  });

  it("kan si at det ikke er ferdig, for sine egne", async () => {
    const b = await somBesteforeldre();
    const id = await venter(b);
    expect((await b.post(`/api/gjoremal/${id}/avvis`)).body.status).toBe("tatt");
  });

  it("godkjenner ikke andres, og slipper ikke gjøremål løs", async () => {
    const f = await somForelder();
    const b = await somBesteforeldre();
    const andres = await venter(f, "Vaske bilen");
    expect((await b.post(`/api/gjoremal/${andres}/godkjenn`)).status).toBe(403);
    expect((await b.post(`/api/gjoremal/${andres}/avvis`)).status).toBe(403);
    expect((await b.post(`/api/gjoremal/${andres}/slipp`)).status).toBe(403);
    expect((await b.post(`/api/gjoremal/${andres}/ta`)).status).toBe(403);
    // Gjøremålet er urørt, og foreldre godkjenner fortsatt
    expect((await f.post(`/api/gjoremal/${andres}/godkjenn`)).body.status).toBe("godkjent");
  });

  it("ser alle barnas poeng, og egne gjentakende gjøremål som hviler", async () => {
    const f = await somForelder();
    const b = await somBesteforeldre();
    const eget = await venter(b, "Egen daglig");
    await db.prepare("UPDATE gjoremal SET gjentas = 'daglig' WHERE id = ?").run(eget);
    const andres = await venter(f, "Andres daglig");
    await db.prepare("UPDATE gjoremal SET gjentas = 'daglig' WHERE id = ?").run(andres);
    await b.post(`/api/gjoremal/${eget}/godkjenn`);
    await f.post(`/api/gjoremal/${andres}/godkjenn`);
    const bTitler = (await b.get("/api/gjoremal")).body
      .filter((g: { status: string }) => g.status === "ledig")
      .map((g: { tittel: string }) => g.tittel);
    expect(bTitler).toEqual(["Egen daglig"]);
    expect((await b.get("/api/gjoremal/poeng")).body).toHaveLength(1);
  });
});

describe("besteforeldre: oppslagstavla", () => {
  const lapp = (a: Agent, tekst = "Hei fra oss") =>
    a.post("/api/oppslag").send({ tekst, farge: "gul" });

  it("kan henge opp lapper og endre og ta ned sine egne", async () => {
    const b = await somBesteforeldre();
    const res = await lapp(b);
    expect(res.status).toBe(201);
    expect(res.body.kanEndre).toBe(true);
    const id = res.body.id as number;
    expect((await b.patch(`/api/oppslag/${id}`).send({ tekst: "Endret" })).body.tekst).toBe(
      "Endret",
    );
    expect((await b.delete(`/api/oppslag/${id}`)).status).toBe(204);
  });

  it("kan ikke endre eller ta ned andres lapper, og ser at de ikke kan det", async () => {
    const f = await somForelder();
    const b = await somBesteforeldre();
    const andres = (await lapp(f, "Fra forelder")).body.id as number;
    const fraBarn = (await lapp(await somHaakon(), "Fra Elias")).body.id as number;
    for (const id of [andres, fraBarn]) {
      expect((await b.patch(`/api/oppslag/${id}`).send({ tekst: "Nei" })).status).toBe(403);
      expect((await b.delete(`/api/oppslag/${id}`)).status).toBe(403);
    }
    const liste = (await b.get("/api/oppslag")).body as { kanEndre: boolean }[];
    expect(liste).toHaveLength(2);
    expect(liste.every((l) => !l.kanEndre)).toBe(true);
  });

  it("foreldre kan fortsatt ta ned besteforeldrenes lapper", async () => {
    const b = await somBesteforeldre();
    const id = (await lapp(b)).body.id as number;
    expect((await (await somForelder()).delete(`/api/oppslag/${id}`)).status).toBe(204);
  });
});
