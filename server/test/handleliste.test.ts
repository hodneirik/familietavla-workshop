import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { loadConfig } from "../src/config.js";
import { createLogger } from "../src/core/logger.js";
import { openDb, type Db } from "../src/db/client.js";
import { migrate } from "../src/db/migrate.js";
import { normaliser } from "../src/modules/handleliste/service.js";
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

const legg = async (a: Agent, navn: string) =>
  (await a.post("/api/handleliste").send({ navn })).body as { id: number; navn: string };
const handle = async (a: Agent, navn: string) => {
  const v = await legg(a, navn);
  await a.post(`/api/handleliste/${v.id}/kjop`);
  return v;
};
const forslagFor = async (a: Agent, q = "") =>
  (await a.get(`/api/handleliste/forslag?q=${encodeURIComponent(q)}`)).body as string[];
const lista = async (a: Agent) =>
  (await a.get("/api/handleliste")).body as { id: number; navn: string; kjopt: boolean }[];

describe("normalisering", () => {
  it("gjør store og små bokstaver og ekstra mellomrom like", () => {
    expect(normaliser("  Lett   MELK ")).toBe("lett melk");
    expect(normaliser("RØMME")).toBe("rømme");
    expect(normaliser("Ærter")).toBe("ærter");
  });
});

describe("handleliste", () => {
  it("krever innlogging", async () => {
    expect((await request(app).get("/api/handleliste")).status).toBe(401);
    expect((await request(app).get("/api/handleliste/forslag?q=m")).status).toBe(401);
    expect((await request(app).post("/api/handleliste").send({ navn: "Melk" })).status).toBe(401);
    expect((await request(app).post("/api/handleliste/1/kjop")).status).toBe(401);
    expect((await request(app).delete("/api/handleliste/1")).status).toBe(401);
  });

  it("alle kan legge til, og navnet ryddes", async () => {
    const h = await agentFor(haakon, "1234");
    const res = await h.post("/api/handleliste").send({ navn: "  Lett   melk " });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      navn: "Lett melk",
      kjopt: false,
      fantesFraFor: false,
      lagtTilAv: { id: haakon, visningsnavn: "Elias" },
    });
    const m = await agentFor(nelly, "5678");
    expect((await lista(m)).map((v) => v.navn)).toEqual(["Lett melk"]);
  });

  it("første bokstav blir stor, også for æ, ø og å", async () => {
    const h = await agentFor(haakon, "1234");
    expect((await legg(h, "melk")).navn).toBe("Melk");
    expect((await legg(h, "økologiske egg")).navn).toBe("Økologiske egg");
    expect((await legg(h, "ÆRTER")).navn).toBe("ÆRTER");
  });

  it("avviser tomme og for lange navn", async () => {
    const h = await agentFor(haakon, "1234");
    expect((await h.post("/api/handleliste").send({ navn: "   " })).status).toBe(400);
    expect((await h.post("/api/handleliste").send({ navn: "x".repeat(61) })).status).toBe(400);
    expect((await h.post("/api/handleliste").send({})).status).toBe(400);
  });

  it("samme vare to ganger gir ikke to rader", async () => {
    const h = await agentFor(haakon, "1234");
    const m = await agentFor(nelly, "5678");
    const første = await legg(h, "Melk");
    const andre = await m.post("/api/handleliste").send({ navn: " melk" });
    expect(andre.status).toBe(200);
    expect(andre.body).toMatchObject({ id: første.id, fantesFraFor: true });
    expect(await lista(h)).toHaveLength(1);
  });

  it("alle kan krysse av og angre, og lista viser det som skal handles først", async () => {
    const h = await agentFor(haakon, "1234");
    const a = await legg(h, "Brød");
    await legg(h, "Egg");
    await legg(h, "Smør");
    const avkrysset = await h.post(`/api/handleliste/${a.id}/kjop`);
    expect(avkrysset.body).toMatchObject({ kjopt: true });
    expect((await lista(h)).map((v) => [v.navn, v.kjopt])).toEqual([
      ["Egg", false],
      ["Smør", false],
      ["Brød", true],
    ]);
    expect((await h.post(`/api/handleliste/${a.id}/angre`)).body.kjopt).toBe(false);
    expect((await lista(h)).map((v) => v.navn)).toEqual(["Brød", "Egg", "Smør"]);
  });

  it("barn kan ikke slette, men forelder kan", async () => {
    const h = await agentFor(haakon, "1234");
    const f = await agentFor(forelder, "9876");
    const v = await legg(h, "Ost");
    expect((await h.delete(`/api/handleliste/${v.id}`)).status).toBe(403);
    expect(await lista(h)).toHaveLength(1);
    expect((await f.delete(`/api/handleliste/${v.id}`)).status).toBe(204);
    expect(await lista(f)).toHaveLength(0);
    expect((await f.delete(`/api/handleliste/${v.id}`)).status).toBe(404);
  });

  it("bare forelder kan fjerne alt som er handlet", async () => {
    const h = await agentFor(haakon, "1234");
    const f = await agentFor(forelder, "9876");
    await handle(h, "Brød");
    await handle(h, "Egg");
    await legg(h, "Melk");
    expect((await h.post("/api/handleliste/fjern-handlede")).status).toBe(403);
    expect((await f.post("/api/handleliste/fjern-handlede")).body).toEqual({ fjernet: 2 });
    expect((await lista(f)).map((v) => v.navn)).toEqual(["Melk"]);
  });

  it("handlede varer vises i 48 timer, og ryddes bort etter 30 dager", async () => {
    const h = await agentFor(haakon, "1234");
    const gammel = await handle(h, "Gammel");
    await handle(h, "Fersk");
    const dagerSiden = (d: number) => new Date(Date.now() - d * 86_400_000).toISOString();
    db.prepare("UPDATE handleliste SET kjopt_tid = ? WHERE id = ?").run(dagerSiden(3), gammel.id);
    expect((await lista(h)).map((v) => v.navn)).toEqual(["Fersk"]);
    db.prepare("UPDATE handleliste SET kjopt_tid = ? WHERE id = ?").run(dagerSiden(31), gammel.id);
    await legg(h, "Ny vare");
    const igjen = db
      .prepare("SELECT COUNT(*) AS n FROM handleliste WHERE id = ?")
      .get(gammel.id) as { n: number };
    expect(igjen.n).toBe(0);
  });

  it("gir 404 for varer som ikke finnes", async () => {
    const h = await agentFor(haakon, "1234");
    expect((await h.post("/api/handleliste/999/kjop")).status).toBe(404);
    expect((await h.post("/api/handleliste/999/angre")).status).toBe(404);
  });

  it("lista har en grense", async () => {
    const h = await agentFor(haakon, "1234");
    const sett = db.prepare("INSERT INTO handleliste (navn, navn_norm) VALUES (?, ?)");
    for (let i = 0; i < 300; i++) sett.run(`Vare ${i}`, `vare ${i}`);
    const res = await h.post("/api/handleliste").send({ navn: "En til" });
    expect(res.status).toBe(409);
    expect(res.body.feil).toMatch(/full/);
  });
});

describe("forslag fra varer som er handlet før", () => {
  it("det finnes ingen forslag før noe er handlet, og å legge til er ikke nok", async () => {
    const h = await agentFor(haakon, "1234");
    await legg(h, "Melk");
    expect(await forslagFor(h, "mel")).toEqual([]);
    expect(await forslagFor(h)).toEqual([]);
  });

  it("en vare som er handlet kommer opp som forslag når man begynner å skrive", async () => {
    const h = await agentFor(haakon, "1234");
    await handle(h, "Melk");
    expect(await forslagFor(h, "m")).toEqual(["Melk"]);
    expect(await forslagFor(h, "MEL")).toEqual(["Melk"]);
    expect(await forslagFor(h, "melkx")).toEqual([]);
    expect(await forslagFor(h, "ost")).toEqual([]);
  });

  it("forslagene deles av alle, uansett hvem som handlet", async () => {
    const h = await agentFor(haakon, "1234");
    const m = await agentFor(nelly, "5678");
    await handle(h, "Yoghurt");
    expect(await forslagFor(m, "yog")).toEqual(["Yoghurt"]);
  });

  it("treffer også midt i navnet, men begynnelsen kommer først", async () => {
    const h = await agentFor(haakon, "1234");
    for (const v of ["Lettmelk", "Melk", "Melkesjokolade", "Havremelk"]) await handle(h, v);
    await handle(h, "Lettmelk"); // handlet to ganger, men treffer midt i navnet
    expect(await forslagFor(h, "melk")).toEqual([
      "Melk",
      "Melkesjokolade",
      "Lettmelk",
      "Havremelk",
    ]);
  });

  it("det man handler oftest kommer først blant like gode treff", async () => {
    const h = await agentFor(haakon, "1234");
    await handle(h, "Brød");
    await handle(h, "Brun saus");
    await handle(h, "Brokkoli");
    await handle(h, "Brokkoli");
    await handle(h, "Brokkoli");
    await handle(h, "Brun saus");
    expect(await forslagFor(h, "br")).toEqual(["Brokkoli", "Brun saus", "Brød"]);
  });

  it("tåler store og små bokstaver og æ, ø og å", async () => {
    const h = await agentFor(haakon, "1234");
    await handle(h, "Rømme");
    await handle(h, "Ærter");
    await handle(h, "Åpen ost");
    expect(await forslagFor(h, "RØM")).toEqual(["Rømme"]);
    expect(await forslagFor(h, "ært")).toEqual(["Ærter"]);
    expect(await forslagFor(h, "åp")).toEqual(["Åpen ost"]);
  });

  it("viser ikke det som allerede står på lista, men det kommer igjen når det er handlet", async () => {
    const h = await agentFor(haakon, "1234");
    const melk = await handle(h, "Melk");
    expect(await forslagFor(h, "mel")).toEqual(["Melk"]);
    const igjen = await legg(h, "Melk");
    expect(igjen.id).not.toBe(melk.id);
    expect(await forslagFor(h, "mel")).toEqual([]);
    await h.post(`/api/handleliste/${igjen.id}/kjop`);
    expect(await forslagFor(h, "mel")).toEqual(["Melk"]);
  });

  it("uten tekst gis de mest handlede, og det er maks åtte", async () => {
    const h = await agentFor(haakon, "1234");
    for (let i = 1; i <= 10; i++) for (let j = 0; j < i; j++) await handle(h, `Vare ${i}`);
    const topp = await forslagFor(h);
    expect(topp).toHaveLength(8);
    expect(topp[0]).toBe("Vare 10");
    expect(topp[7]).toBe("Vare 3");
  });

  it("skrivemåten fra tidligere brukes når man skriver varen på nytt", async () => {
    const h = await agentFor(haakon, "1234");
    await handle(h, "Kaffe");
    const ny = await legg(h, "KAFFE");
    expect(ny.navn).toBe("Kaffe");
  });

  it("angrer man en avkrysning, teller den ikke som handlet", async () => {
    const h = await agentFor(haakon, "1234");
    const v = await legg(h, "Melk");
    await h.post(`/api/handleliste/${v.id}/kjop`);
    await h.post(`/api/handleliste/${v.id}/angre`);
    expect(await forslagFor(h, "mel")).toEqual([]);
    await h.post(`/api/handleliste/${v.id}/kjop`);
    await h.post(`/api/handleliste/${v.id}/kjop`);
    expect(await forslagFor(h, "mel")).toEqual(["Melk"]);
    const rad = db.prepare("SELECT antall_kjopt AS n FROM kjente_varer").get() as { n: number };
    expect(rad.n).toBe(1);
  });

  it("tegn som % og _ i søket treffer ikke alt", async () => {
    const h = await agentFor(haakon, "1234");
    await handle(h, "Melk");
    await handle(h, "Brød");
    expect(await forslagFor(h, "%")).toEqual([]);
    expect(await forslagFor(h, "_")).toEqual([]);
    expect(await forslagFor(h, "m_lk")).toEqual([]);
  });

  it("sletting fra lista fjerner ikke forslaget", async () => {
    const h = await agentFor(haakon, "1234");
    const f = await agentFor(forelder, "9876");
    const v = await handle(h, "Smør");
    await f.delete(`/api/handleliste/${v.id}`);
    expect(await forslagFor(h, "smø")).toEqual(["Smør"]);
  });

  it("avviser for lange søk", async () => {
    const h = await agentFor(haakon, "1234");
    expect((await h.get(`/api/handleliste/forslag?q=${"x".repeat(61)}`)).status).toBe(400);
  });
});
