import { copyFileSync, mkdirSync, mkdtempSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { loadConfig } from "../src/config.js";
import { ukenr, norskDato, osloDato } from "../src/core/dato.js";
import { createLogger } from "../src/core/logger.js";
import { openDb, type Db } from "../src/db/client.js";
import { migrate, migrationsDir } from "../src/db/migrate.js";
import { createUser } from "../src/modules/users/service.js";

let db: Db;
let app: ReturnType<typeof createApp>;
let forelder: number;
let haakon: number;
let nelly: number;
/** «Nå» i testene. 6. oktober 2026 kl. 12 norsk tid. */
let nå = Date.parse("2026-10-06T10:00:00Z");

beforeEach(() => {
  nå = Date.parse("2026-10-06T10:00:00Z");
  db = openDb(":memory:");
  migrate(db);
  app = createApp({
    config: loadConfig({
      SESSION_SECRET: "x".repeat(32),
      WEB_DIR: "/finnes-ikke",
      VAER_AKTIV: "false",
    }),
    db,
    log: createLogger("error"),
    naa: () => nå,
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

const lagRett = async (
  f: Agent,
  tittel: string,
  ingredienser: string[] = [],
  notat: string | null = null,
) => {
  const res = await f.post("/api/middag/retter").send({ tittel, ingredienser, notat });
  expect(res.status, JSON.stringify(res.body)).toBe(201);
  return res.body as { id: number };
};
const planlegg = (f: Agent, dato: string, rettId: number) =>
  f.put(`/api/middag/${dato}`).send({ rettId });
const uke = (a: Agent, fra = "2026-10-05", til = "2026-10-12") =>
  a.get(`/api/middag?fra=${fra}&til=${til}`);
interface RettSvar {
  id: number;
  tittel: string;
  notat?: string | null;
  ingredienser?: string[];
  snitt: number | null;
  antall: number;
  minSnitt: number | null;
  minAntall: number;
}
const retter = async (a: Agent) => (await a.get("/api/middag/retter")).body as RettSvar[];
const handleliste = async (a: Agent) =>
  (await a.get("/api/handleliste")).body as {
    id: number;
    navn: string;
    notat: string | null;
    egetNotat: string | null;
    kjopt: boolean;
  }[];
const navnPaLista = async (a: Agent) =>
  (await handleliste(a)).filter((v) => !v.kjopt).map((v) => v.navn);
const stjerner = (a: Agent, dato: string, n: number) =>
  a.put(`/api/middag/${dato}/stjerner`).send({ stjerner: n });

describe("datohjelpere på serveren", () => {
  it("uketall og norsk dato", () => {
    expect(ukenr("2026-10-09")).toBe(41);
    expect(ukenr("2026-10-12")).toBe(42);
    expect(ukenr("2026-01-01")).toBe(1);
    expect(ukenr("2026-12-31")).toBe(53);
    expect(ukenr("2024-12-30")).toBe(1);
    expect(norskDato("2026-10-09")).toBe("fredag 9. okt.");
    expect(osloDato(Date.parse("2026-10-06T22:30:00Z"))).toBe("2026-10-07");
    expect(osloDato(Date.parse("2026-10-06T21:30:00Z"))).toBe("2026-10-06");
  });
});

describe("middagsretter", () => {
  it("krever innlogging", async () => {
    expect((await request(app).get("/api/middag/retter")).status).toBe(401);
    expect((await request(app).post("/api/middag/retter").send({ tittel: "Taco" })).status).toBe(
      401,
    );
    expect((await request(app).put("/api/middag/2026-10-06").send({ rettId: 1 })).status).toBe(401);
    expect(
      (await request(app).put("/api/middag/2026-10-06/stjerner").send({ stjerner: 5 })).status,
    ).toBe(401);
  });

  it("bare foreldre kan lage, endre og slette retter", async () => {
    const f = await agentFor(forelder, "9876");
    const h = await agentFor(haakon, "1234");
    expect((await h.post("/api/middag/retter").send({ tittel: "Fusk" })).status).toBe(403);
    const { id } = await lagRett(f, "Taco", ["Tortilla", "Kjøttdeig"], "Mild saus til barna");
    expect(
      (await h.put(`/api/middag/retter/${id}`).send({ tittel: "Annet", ingredienser: [] })).status,
    ).toBe(403);
    expect((await h.delete(`/api/middag/retter/${id}`)).status).toBe(403);
    const endret = await f
      .put(`/api/middag/retter/${id}`)
      .send({ tittel: "Tacofredag", ingredienser: ["Tortilla"], notat: null });
    expect(endret.body).toMatchObject({
      tittel: "Tacofredag",
      ingredienser: ["Tortilla"],
      notat: null,
    });
    expect((await f.delete(`/api/middag/retter/${id}`)).status).toBe(204);
    expect(await retter(f)).toEqual([]);
    expect((await f.delete(`/api/middag/retter/${id}`)).status).toBe(404);
  });

  it("forelder ser notat og ingredienser, barn ser bare tittel og score", async () => {
    const f = await agentFor(forelder, "9876");
    const h = await agentFor(haakon, "1234");
    await lagRett(f, "Taco", ["Tortilla"], "Mild saus");
    expect((await retter(f))[0]).toMatchObject({
      tittel: "Taco",
      notat: "Mild saus",
      ingredienser: ["Tortilla"],
    });
    expect((await retter(h))[0]).toEqual({
      id: expect.any(Number),
      tittel: "Taco",
      snitt: null,
      antall: 0,
      minSnitt: null,
      minAntall: 0,
    });
  });

  it("rydder ingrediensene: trimmer, fjerner tomme og dubletter", async () => {
    const f = await agentFor(forelder, "9876");
    const res = await f.post("/api/middag/retter").send({
      tittel: "Lasagne",
      ingredienser: ["  Pasta  ", "", "pasta", "Kjøttdeig", "  ", "RIVEN   ost"],
    });
    expect(res.body.ingredienser).toEqual(["Pasta", "Kjøttdeig", "RIVEN ost"]);
  });

  it("avviser ugyldige retter", async () => {
    const f = await agentFor(forelder, "9876");
    const post = async (data: object) => (await f.post("/api/middag/retter").send(data)).status;
    expect(await post({ tittel: "  " })).toBe(400);
    expect(await post({ tittel: "x".repeat(81) })).toBe(400);
    expect(await post({ tittel: "Taco", ingredienser: ["x".repeat(61)] })).toBe(400);
    expect(
      await post({
        tittel: "Taco",
        ingredienser: Array.from({ length: 61 }, (_, i) => `Vare ${i}`),
      }),
    ).toBe(400);
    expect(
      await post({
        tittel: "Taco",
        ingredienser: Array.from({ length: 41 }, (_, i) => `Vare ${i}`),
      }),
    ).toBe(400);
    expect(await post({ tittel: "Taco", notat: "x".repeat(1001) })).toBe(400);
    expect(await post({})).toBe(400);
    expect(await post({ tittel: "Taco" })).toBe(201);
  });

  it("to retter kan ikke ha samme navn, uavhengig av store og små bokstaver", async () => {
    const f = await agentFor(forelder, "9876");
    const { id } = await lagRett(f, "Taco");
    expect((await f.post("/api/middag/retter").send({ tittel: " taco " })).status).toBe(409);
    expect(
      (await f.put(`/api/middag/retter/${id}`).send({ tittel: "TACO", ingredienser: [] })).status,
    ).toBe(200);
    const annen = await lagRett(f, "Pizza");
    expect(
      (await f.put(`/api/middag/retter/${annen.id}`).send({ tittel: "Taco", ingredienser: [] }))
        .status,
    ).toBe(409);
  });

  it("endrer man navnet, får dagene som er planlagt det nye navnet", async () => {
    const f = await agentFor(forelder, "9876");
    const { id } = await lagRett(f, "Taco");
    await planlegg(f, "2026-10-09", id);
    await f.put(`/api/middag/retter/${id}`).send({ tittel: "Tacofredag", ingredienser: [] });
    expect((await uke(f)).body[0].rett).toBe("Tacofredag");
  });

  it("sletter man en rett, beholder dagene navnet", async () => {
    const f = await agentFor(forelder, "9876");
    const { id } = await lagRett(f, "Taco");
    await planlegg(f, "2026-10-09", id);
    await f.delete(`/api/middag/retter/${id}`);
    expect((await uke(f)).body).toEqual([
      { dato: "2026-10-09", rettId: null, rett: "Taco", notat: null, minStjerner: null },
    ]);
  });
});

describe("planlegge middag", () => {
  it("bare foreldre kan velge middag, og bare fra listen med retter", async () => {
    const f = await agentFor(forelder, "9876");
    const h = await agentFor(haakon, "1234");
    const { id } = await lagRett(f, "Taco", [], "Husk lefser");
    expect((await planlegg(h, "2026-10-09", id)).status).toBe(403);
    expect((await h.delete("/api/middag/2026-10-09")).status).toBe(403);
    expect((await f.put("/api/middag/2026-10-09").send({ rett: "Fritekst" })).status).toBe(400);
    expect((await f.put("/api/middag/2026-10-09").send({ rettId: 999 })).status).toBe(404);
    const ok = await planlegg(f, "2026-10-09", id);
    expect(ok.status).toBe(200);
    expect(ok.body).toEqual({
      dato: "2026-10-09",
      rettId: id,
      rett: "Taco",
      notat: "Husk lefser",
      minStjerner: null,
    });
    expect((await uke(h)).body).toHaveLength(1);
  });

  it("avviser ugyldige datoer og tidsrom", async () => {
    const f = await agentFor(forelder, "9876");
    const { id } = await lagRett(f, "Taco");
    expect((await planlegg(f, "2026-02-30", id)).status).toBe(400);
    expect((await planlegg(f, "i-morgen", id)).status).toBe(400);
    expect((await f.delete("/api/middag/32-13-2026")).status).toBe(400);
    for (const q of [
      "",
      "?fra=2026-10-05",
      "?fra=2026-10-12&til=2026-10-05",
      "?fra=2026-10-05&til=2026-10-05",
      "?fra=2026-01-01&til=2026-12-31",
      "?fra=x&til=y",
    ]) {
      expect((await f.get(`/api/middag${q}`)).status).toBe(400);
    }
  });

  it("viser bare dagene i tidsrommet, i rekkefølge", async () => {
    const f = await agentFor(forelder, "9876");
    const { id } = await lagRett(f, "Taco");
    for (const d of ["2026-10-11", "2026-10-05", "2026-10-12", "2026-10-04"])
      await planlegg(f, d, id);
    expect((await uke(f)).body.map((m: { dato: string }) => m.dato)).toEqual([
      "2026-10-05",
      "2026-10-11",
    ]);
  });

  it("fjerner en middag, og gir 404 hvis det ikke er noen", async () => {
    const f = await agentFor(forelder, "9876");
    const { id } = await lagRett(f, "Taco");
    await planlegg(f, "2026-10-09", id);
    expect((await f.delete("/api/middag/2026-10-09")).status).toBe(204);
    expect((await uke(f)).body).toEqual([]);
    expect((await f.delete("/api/middag/2026-10-09")).status).toBe(404);
  });

  it("samme rett to ganger er ingen endring, og ny rett erstatter den gamle", async () => {
    const f = await agentFor(forelder, "9876");
    const a = await lagRett(f, "Taco");
    const b = await lagRett(f, "Pizza");
    await planlegg(f, "2026-10-09", a.id);
    expect((await planlegg(f, "2026-10-09", a.id)).status).toBe(200);
    await planlegg(f, "2026-10-09", b.id);
    expect((await uke(f)).body).toEqual([
      { dato: "2026-10-09", rettId: b.id, rett: "Pizza", notat: null, minStjerner: null },
    ]);
  });

  it("alt logges", async () => {
    const f = await agentFor(forelder, "9876");
    const { id } = await lagRett(f, "Taco");
    await planlegg(f, "2026-10-09", id);
    await f.put(`/api/middag/retter/${id}`).send({ tittel: "Taco 2", ingredienser: [] });
    await f.delete("/api/middag/2026-10-09");
    await f.delete(`/api/middag/retter/${id}`);
    const logg = db
      .prepare(
        "SELECT handling FROM audit_log WHERE handling LIKE 'rett_%' OR handling LIKE 'middag_%' ORDER BY id",
      )
      .all();
    expect(logg).toEqual([
      { handling: "rett_opprettet" },
      { handling: "middag_satt" },
      { handling: "rett_endret" },
      { handling: "middag_fjernet" },
      { handling: "rett_slettet" },
    ]);
  });
});

describe("ingredienser til handlelisten", () => {
  it("legger ingrediensene på lista med når de må handles innen i notatet", async () => {
    const f = await agentFor(forelder, "9876");
    const h = await agentFor(haakon, "1234");
    const { id } = await lagRett(f, "Taco", ["Tortilla", "kjøttdeig", "Salsa"]);
    await planlegg(f, "2026-10-09", id);
    const lista = await handleliste(h);
    expect(lista.map((v) => v.navn)).toEqual(["Tortilla", "Kjøttdeig", "Salsa"]);
    expect(lista.every((v) => v.notat === "Til Taco · fre 9. okt.")).toBe(true);
    expect(lista.every((v) => v.egetNotat === null)).toBe(true);
    expect((await h.get("/api/handleliste")).body[0].lagtTilAv.visningsnavn).toBe("Anita");
  });

  it("det som allerede står på lista, brukes og ikke legges inn to ganger, og notatene slås sammen", async () => {
    const f = await agentFor(forelder, "9876");
    const h = await agentFor(haakon, "1234");
    await h.post("/api/handleliste").send({ navn: "Ost", notat: "Helst Jarlsberg" });
    const taco = await lagRett(f, "Taco", ["Ost", "Tortilla"]);
    const pizza = await lagRett(f, "Pizza", ["Ost", "Deig"]);
    await planlegg(f, "2026-10-09", taco.id);
    await planlegg(f, "2026-10-11", pizza.id);
    const lista = await handleliste(h);
    expect(lista.map((v) => v.navn)).toEqual(["Ost", "Tortilla", "Deig"]);
    const ost = lista.find((v) => v.navn === "Ost")!;
    expect(ost.egetNotat).toBe("Helst Jarlsberg");
    expect(ost.notat).toBe("Helst Jarlsberg\nTil Taco · fre 9. okt.\nTil Pizza · søn 11. okt.");
  });

  it("byttes retten, tas ingrediensene som var lagt til for den forrige bort", async () => {
    const f = await agentFor(forelder, "9876");
    const taco = await lagRett(f, "Taco", ["Tortilla", "Ost"]);
    const pizza = await lagRett(f, "Pizza", ["Deig", "Ost"]);
    await planlegg(f, "2026-10-09", taco.id);
    await planlegg(f, "2026-10-09", pizza.id);
    expect(await navnPaLista(f)).toEqual(["Deig", "Ost"]);
    const ost = (await handleliste(f)).find((v) => v.navn === "Ost")!;
    expect(ost.notat).toBe("Til Pizza · fre 9. okt.");
  });

  it("fjernes middagen, tas ingrediensene bort igjen, men ikke det andre trenger", async () => {
    const f = await agentFor(forelder, "9876");
    const h = await agentFor(haakon, "1234");
    await h.post("/api/handleliste").send({ navn: "Melk" });
    const taco = await lagRett(f, "Taco", ["Tortilla", "Melk"]);
    await planlegg(f, "2026-10-09", taco.id);
    expect(await navnPaLista(f)).toEqual(["Melk", "Tortilla"]);
    await f.delete("/api/middag/2026-10-09");
    expect(await navnPaLista(f)).toEqual(["Melk"]);
    expect((await handleliste(f))[0]).toMatchObject({ navn: "Melk", notat: null });
  });

  it("en vare som to middager trenger, blir stående til begge er fjernet", async () => {
    const f = await agentFor(forelder, "9876");
    const a = await lagRett(f, "Taco", ["Ost"]);
    const b = await lagRett(f, "Pizza", ["Ost"]);
    await planlegg(f, "2026-10-09", a.id);
    await planlegg(f, "2026-10-11", b.id);
    await f.delete("/api/middag/2026-10-09");
    expect(await navnPaLista(f)).toEqual(["Ost"]);
    expect((await handleliste(f))[0]!.notat).toBe("Til Pizza · søn 11. okt.");
    await f.delete("/api/middag/2026-10-11");
    expect(await navnPaLista(f)).toEqual([]);
  });

  it("varer som er handlet eller har fått eget notat blir stående", async () => {
    const f = await agentFor(forelder, "9876");
    const h = await agentFor(haakon, "1234");
    const taco = await lagRett(f, "Taco", ["Tortilla", "Ost", "Salsa"]);
    await planlegg(f, "2026-10-09", taco.id);
    const lista = await handleliste(h);
    const tortilla = lista.find((v) => v.navn === "Tortilla")!;
    const ost = lista.find((v) => v.navn === "Ost")!;
    await h.post(`/api/handleliste/${tortilla.id}/kjop`);
    await h.patch(`/api/handleliste/${ost.id}`).send({ notat: "Revet" });
    await f.delete("/api/middag/2026-10-09");
    const etter = await handleliste(f);
    expect(etter.map((v) => [v.navn, v.kjopt, v.notat])).toEqual([
      ["Ost", false, "Revet"],
      ["Tortilla", true, null],
    ]);
  });

  it("en vare som er handlet kan legges inn på nytt for en ny middag", async () => {
    const f = await agentFor(forelder, "9876");
    const h = await agentFor(haakon, "1234");
    const taco = await lagRett(f, "Taco", ["Tortilla"]);
    await planlegg(f, "2026-10-09", taco.id);
    const første = (await handleliste(h))[0]!;
    await h.post(`/api/handleliste/${første.id}/kjop`);
    await planlegg(f, "2026-10-16", taco.id);
    const lista = await handleliste(h);
    expect(lista.filter((v) => !v.kjopt).map((v) => v.navn)).toEqual(["Tortilla"]);
    expect(lista.filter((v) => !v.kjopt)[0]!.notat).toBe("Til Taco · fre 16. okt.");
  });

  it("endrer man ingrediensene i en rett senere, endres ikke dager som allerede er planlagt", async () => {
    const f = await agentFor(forelder, "9876");
    const { id } = await lagRett(f, "Taco", ["Tortilla"]);
    await planlegg(f, "2026-10-09", id);
    await f
      .put(`/api/middag/retter/${id}`)
      .send({ tittel: "Taco", ingredienser: ["Tortilla", "Agurk"] });
    expect(await navnPaLista(f)).toEqual(["Tortilla"]);
    await planlegg(f, "2026-10-16", id);
    expect(await navnPaLista(f)).toEqual(["Tortilla", "Agurk"]);
  });

  it("er lista full, rulles hele planleggingen tilbake", async () => {
    const f = await agentFor(forelder, "9876");
    const sett = db.prepare("INSERT INTO handleliste (navn, navn_norm) VALUES (?, ?)");
    for (let i = 0; i < 299; i++) sett.run(`Vare ${i}`, `vare ${i}`);
    const { id } = await lagRett(f, "Taco", ["Tortilla", "Ost"]);
    const res = await planlegg(f, "2026-10-09", id);
    expect(res.status).toBe(409);
    expect(res.body.feil).toMatch(/full/);
    expect((await uke(f)).body).toEqual([]);
    expect((await navnPaLista(f)).filter((n) => n === "Tortilla")).toEqual([]);
    expect(db.prepare("SELECT COUNT(*) AS n FROM handleliste_middag").get()).toEqual({ n: 0 });
  });

  it("rett uten ingredienser legger ikke noe på lista", async () => {
    const f = await agentFor(forelder, "9876");
    const { id } = await lagRett(f, "Rester");
    await planlegg(f, "2026-10-09", id);
    expect(await navnPaLista(f)).toEqual([]);
  });
});

describe("velge hvilke ingredienser som skal på handlelisten", () => {
  const planleggMed = (f: Agent, dato: string, rettId: number, ingredienser?: string[]) =>
    f.put(`/api/middag/${dato}`).send({ rettId, ingredienser });

  it("bare de ingrediensene man velger legges på lista", async () => {
    const f = await agentFor(forelder, "9876");
    const { id } = await lagRett(f, "Taco", ["Tortilla", "Kjøttdeig", "Salsa", "Ost"]);
    const res = await planleggMed(f, "2026-10-09", id, ["Tortilla", "ost"]);
    expect(res.status).toBe(200);
    expect(await navnPaLista(f)).toEqual(["Tortilla", "Ost"]);
    expect((await handleliste(f)).every((v) => v.notat === "Til Taco · fre 9. okt.")).toBe(true);
  });

  it("uten liste legges alle på lista, som før", async () => {
    const f = await agentFor(forelder, "9876");
    const { id } = await lagRett(f, "Taco", ["Tortilla", "Salsa"]);
    await planleggMed(f, "2026-10-09", id);
    expect(await navnPaLista(f)).toEqual(["Tortilla", "Salsa"]);
  });

  it("en tom liste betyr at ingenting legges på lista, men middagen blir valgt", async () => {
    const f = await agentFor(forelder, "9876");
    const { id } = await lagRett(f, "Taco", ["Tortilla", "Salsa"]);
    const res = await planleggMed(f, "2026-10-09", id, []);
    expect(res.status).toBe(200);
    expect(res.body.rett).toBe("Taco");
    expect(await navnPaLista(f)).toEqual([]);
    expect(db.prepare("SELECT COUNT(*) AS n FROM handleliste_middag").get()).toEqual({ n: 0 });
  });

  it("avviser ingredienser som ikke er i retten, og da blir ingenting gjort", async () => {
    const f = await agentFor(forelder, "9876");
    const { id } = await lagRett(f, "Taco", ["Tortilla"]);
    const res = await planleggMed(f, "2026-10-09", id, ["Tortilla", "Kaviar"]);
    expect(res.status).toBe(400);
    expect(res.body.feil).toMatch(/ikke er i retten/);
    expect((await uke(f)).body).toEqual([]);
    expect(await navnPaLista(f)).toEqual([]);
  });

  it("tåler store og små bokstaver, ekstra mellomrom og at samme ingrediens er nevnt to ganger", async () => {
    const f = await agentFor(forelder, "9876");
    const { id } = await lagRett(f, "Taco", ["Riven ost", "Tortilla"]);
    await planleggMed(f, "2026-10-09", id, ["  RIVEN   ost ", "riven ost"]);
    expect(await navnPaLista(f)).toEqual(["Riven ost"]);
  });

  it("en valgt ingrediens som står på lista fra før, får notatet om når den må handles innen", async () => {
    const f = await agentFor(forelder, "9876");
    const h = await agentFor(haakon, "1234");
    await h.post("/api/handleliste").send({ navn: "Ost" });
    const { id } = await lagRett(f, "Taco", ["Ost", "Salsa"]);
    await planleggMed(f, "2026-10-09", id, ["Ost"]);
    const lista = await handleliste(h);
    expect(lista.map((v) => v.navn)).toEqual(["Ost"]);
    expect(lista[0]!.notat).toBe("Til Taco · fre 9. okt.");
  });

  it("byttes retten, gjelder det nye valget, og de ikke valgte hører aldri til noen middag", async () => {
    const f = await agentFor(forelder, "9876");
    const taco = await lagRett(f, "Taco", ["Tortilla", "Ost", "Salsa"]);
    const pizza = await lagRett(f, "Pizza", ["Deig", "Ost"]);
    await planleggMed(f, "2026-10-09", taco.id, ["Tortilla", "Ost"]);
    await planleggMed(f, "2026-10-09", pizza.id, ["Deig"]);
    expect(await navnPaLista(f)).toEqual(["Deig"]);
    await f.delete("/api/middag/2026-10-09");
    expect(await navnPaLista(f)).toEqual([]);
  });

  it("velger man samme rett på nytt, endres ingenting", async () => {
    const f = await agentFor(forelder, "9876");
    const { id } = await lagRett(f, "Taco", ["Tortilla", "Salsa"]);
    await planleggMed(f, "2026-10-09", id, ["Tortilla"]);
    await planleggMed(f, "2026-10-09", id, ["Tortilla", "Salsa"]);
    expect(await navnPaLista(f)).toEqual(["Tortilla"]);
  });

  it("barn kan ikke velge middag, heller ikke med ingredienser", async () => {
    const f = await agentFor(forelder, "9876");
    const h = await agentFor(haakon, "1234");
    const { id } = await lagRett(f, "Taco", ["Tortilla"]);
    expect((await planleggMed(h, "2026-10-09", id, ["Tortilla"])).status).toBe(403);
    expect(await navnPaLista(f)).toEqual([]);
  });

  it("avviser ugyldig format på listen", async () => {
    const f = await agentFor(forelder, "9876");
    const { id } = await lagRett(f, "Taco", ["Tortilla"]);
    expect(
      (await f.put("/api/middag/2026-10-09").send({ rettId: id, ingredienser: "Tortilla" })).status,
    ).toBe(400);
    expect(
      (await f.put("/api/middag/2026-10-09").send({ rettId: id, ingredienser: [5] })).status,
    ).toBe(400);
    expect(
      (await f.put("/api/middag/2026-10-09").send({ rettId: id, ingredienser: ["x".repeat(61)] }))
        .status,
    ).toBe(400);
  });
});

describe("notat i handlelisten", () => {
  it("alle kan legge inn en vare med notat og endre det", async () => {
    const h = await agentFor(haakon, "1234");
    const m = await agentFor(nelly, "5678");
    const ny = await h.post("/api/handleliste").send({ navn: "Melk", notat: "  2 liter  " });
    expect(ny.body).toMatchObject({ navn: "Melk", notat: "2 liter", egetNotat: "2 liter" });
    const endret = await m
      .patch(`/api/handleliste/${ny.body.id}`)
      .send({ notat: "Lettmelk, 3 liter" });
    expect(endret.body).toMatchObject({
      notat: "Lettmelk, 3 liter",
      egetNotat: "Lettmelk, 3 liter",
    });
    const tomt = await m.patch(`/api/handleliste/${ny.body.id}`).send({ notat: "   " });
    expect(tomt.body).toMatchObject({ notat: null, egetNotat: null });
  });

  it("en vare uten notat har et tomt notat, ikke noe annet", async () => {
    const h = await agentFor(haakon, "1234");
    expect((await h.post("/api/handleliste").send({ navn: "Egg" })).body).toMatchObject({
      notat: null,
      egetNotat: null,
    });
  });

  it("avviser for langt notat og ukjente varer", async () => {
    const h = await agentFor(haakon, "1234");
    const v = (await h.post("/api/handleliste").send({ navn: "Egg" })).body;
    expect(
      (await h.patch(`/api/handleliste/${v.id}`).send({ notat: "x".repeat(201) })).status,
    ).toBe(400);
    expect(
      (await h.post("/api/handleliste").send({ navn: "Smør", notat: "x".repeat(201) })).status,
    ).toBe(400);
    expect((await h.patch("/api/handleliste/999").send({ notat: "hei" })).status).toBe(404);
    expect(
      (await request(app).patch(`/api/handleliste/${v.id}`).send({ notat: "hei" })).status,
    ).toBe(401);
  });

  it("legger man inn en vare som står der, får den notatet hvis den ikke hadde noe", async () => {
    const h = await agentFor(haakon, "1234");
    await h.post("/api/handleliste").send({ navn: "Egg" });
    const igjen = await h.post("/api/handleliste").send({ navn: "egg", notat: "12 stk" });
    expect(igjen.body).toMatchObject({ fantesFraFor: true, notat: "12 stk" });
    const tredje = await h.post("/api/handleliste").send({ navn: "Egg", notat: "annet" });
    expect(tredje.body.notat).toBe("12 stk");
  });
});

describe("stjerner", () => {
  it("barna kan gi dagens middag fra 1 til 5 stjerner og endre det samme dag, men ikke voksne", async () => {
    const f = await agentFor(forelder, "9876");
    const h = await agentFor(haakon, "1234");
    const { id } = await lagRett(f, "Taco");
    await planlegg(f, "2026-10-06", id);
    const første = await stjerner(h, "2026-10-06", 3);
    expect(første.status).toBe(200);
    expect(first(første.body)).toBe(3);
    expect(first((await stjerner(h, "2026-10-06", 5)).body)).toBe(5);
    expect((await uke(h)).body[0].minStjerner).toBe(5);
    expect((await uke(f)).body[0].minStjerner).toBeNull();
    const voksen = await stjerner(f, "2026-10-06", 4);
    expect(voksen.status).toBe(403);
    expect(voksen.body.feil).toBe("Bare barna gir stjerner");
    expect(db.prepare("SELECT COUNT(*) AS n FROM middag_stjerner").get()).toEqual({ n: 1 });
    // Voksne ser fortsatt snittet i retter
    expect((await retter(f))[0]).toMatchObject({
      snitt: 5,
      antall: 1,
      minSnitt: null,
      minAntall: 0,
    });
  });

  it("bare 1 til 5 hele stjerner", async () => {
    const f = await agentFor(forelder, "9876");
    const h = await agentFor(haakon, "1234");
    const { id } = await lagRett(f, "Taco");
    await planlegg(f, "2026-10-06", id);
    for (const n of [0, 6, -1, 2.5, "3", null]) {
      expect(
        (await h.put("/api/middag/2026-10-06/stjerner").send({ stjerner: n })).status,
        String(n),
      ).toBe(400);
    }
    expect((await h.put("/api/middag/2026-10-06/stjerner").send({})).status).toBe(400);
  });

  it("bare dagens middag kan få stjerner, og bare hvis det er en middag", async () => {
    const f = await agentFor(forelder, "9876");
    const h = await agentFor(haakon, "1234");
    const { id } = await lagRett(f, "Taco");
    await planlegg(f, "2026-10-05", id);
    await planlegg(f, "2026-10-07", id);
    expect((await stjerner(h, "2026-10-05", 5)).status).toBe(409);
    expect((await stjerner(h, "2026-10-07", 5)).status).toBe(409);
    expect((await stjerner(h, "2026-10-06", 5)).status).toBe(404);
    expect((await stjerner(h, "2026-02-30", 5)).status).toBe(400);
    nå = Date.parse("2026-10-07T10:00:00Z");
    expect((await stjerner(h, "2026-10-07", 5)).status).toBe(200);
  });

  it("«i dag» følger norsk tid, ikke UTC", async () => {
    const f = await agentFor(forelder, "9876");
    const h = await agentFor(haakon, "1234");
    const { id } = await lagRett(f, "Taco");
    await planlegg(f, "2026-10-07", id);
    nå = Date.parse("2026-10-06T22:30:00Z"); // 00:30 den 7. oktober i Norge
    expect((await stjerner(h, "2026-10-07", 4)).status).toBe(200);
  });

  it("snittet for en rett er snittet av alle stemmer, og hver gang retten serveres gir nye stemmer", async () => {
    const f = await agentFor(forelder, "9876");
    const h = await agentFor(haakon, "1234");
    const m = await agentFor(nelly, "5678");
    const { id } = await lagRett(f, "Taco");
    await planlegg(f, "2026-10-06", id);
    await stjerner(h, "2026-10-06", 5);
    await stjerner(m, "2026-10-06", 3);
    let rett = (await retter(h))[0]!;
    expect(rett).toMatchObject({ snitt: 4, antall: 2, minSnitt: 5, minAntall: 1 });

    // Uka etter serveres Taco igjen. Elias gir 1 stjerne, og Nelly gir ingenting.
    await planlegg(f, "2026-10-13", id);
    nå = Date.parse("2026-10-13T10:00:00Z");
    await stjerner(h, "2026-10-13", 1);
    rett = (await retter(h))[0]!;
    expect(rett).toMatchObject({ snitt: 3, antall: 3, minSnitt: 3, minAntall: 2 });
    expect((await retter(m))[0]).toMatchObject({ snitt: 3, minSnitt: 3, minAntall: 1 });
  });

  it("snittet rundes til to desimaler", async () => {
    const f = await agentFor(forelder, "9876");
    const h = await agentFor(haakon, "1234");
    const m = await agentFor(nelly, "5678");
    const { id } = await lagRett(f, "Taco");
    await planlegg(f, "2026-10-06", id);
    await stjerner(h, "2026-10-06", 5);
    await stjerner(m, "2026-10-06", 4);
    await planlegg(f, "2026-10-13", id);
    nå = Date.parse("2026-10-13T10:00:00Z");
    await stjerner(h, "2026-10-13", 4);
    expect((await retter(f))[0]!.snitt).toBe(4.33);
  });

  it("retter sorteres etter snittet, best først, og retter uten stemmer kommer sist", async () => {
    const f = await agentFor(forelder, "9876");
    const h = await agentFor(haakon, "1234");
    const sakte = await lagRett(f, "Fiskekaker");
    const topp = await lagRett(f, "Pizza");
    const midt = await lagRett(f, "Taco");
    await lagRett(f, "Ærtesuppe");
    await lagRett(f, "Boller");
    const gi = async (rettId: number, dato: string, n: number) => {
      await planlegg(f, dato, rettId);
      nå = Date.parse(`${dato}T10:00:00Z`);
      await stjerner(h, dato, n);
    };
    await gi(sakte.id, "2026-10-06", 2);
    await gi(topp.id, "2026-10-07", 5);
    await gi(midt.id, "2026-10-08", 4);
    const rekkefølge = (await retter(h)).map((r) => r.tittel);
    expect(rekkefølge).toEqual(["Pizza", "Taco", "Fiskekaker", "Boller", "Ærtesuppe"]);
    expect((await retter(f)).map((r) => r.tittel)).toEqual(rekkefølge);
  });

  it("ved lik score kommer den med flest stemmer først", async () => {
    const f = await agentFor(forelder, "9876");
    const h = await agentFor(haakon, "1234");
    const m = await agentFor(nelly, "5678");
    const a = await lagRett(f, "Aaa");
    const b = await lagRett(f, "Bbb");
    await planlegg(f, "2026-10-06", a.id);
    await stjerner(h, "2026-10-06", 4);
    await planlegg(f, "2026-10-07", b.id);
    nå = Date.parse("2026-10-07T10:00:00Z");
    await stjerner(h, "2026-10-07", 4);
    await stjerner(m, "2026-10-07", 4);
    expect((await retter(f)).map((r) => r.tittel)).toEqual(["Bbb", "Aaa"]);
  });

  it("byttes retten for dagen, nullstilles stjernene, og fjernes dagen, forsvinner de", async () => {
    const f = await agentFor(forelder, "9876");
    const h = await agentFor(haakon, "1234");
    const a = await lagRett(f, "Taco");
    const b = await lagRett(f, "Pizza");
    await planlegg(f, "2026-10-06", a.id);
    await stjerner(h, "2026-10-06", 5);
    await planlegg(f, "2026-10-06", a.id);
    expect((await retter(f)).find((r) => r.tittel === "Taco")!.antall).toBe(1);
    await planlegg(f, "2026-10-06", b.id);
    expect((await retter(f)).every((r) => r.antall === 0)).toBe(true);
    await stjerner(h, "2026-10-06", 2);
    await f.delete("/api/middag/2026-10-06");
    expect((await retter(f)).every((r) => r.antall === 0)).toBe(true);
    expect(db.prepare("SELECT COUNT(*) AS n FROM middag_stjerner").get()).toEqual({ n: 0 });
  });

  it("sletter man en rett, telles ikke stjernene den hadde lenger", async () => {
    const f = await agentFor(forelder, "9876");
    const h = await agentFor(haakon, "1234");
    const a = await lagRett(f, "Taco");
    await planlegg(f, "2026-10-06", a.id);
    await stjerner(h, "2026-10-06", 5);
    await f.delete(`/api/middag/retter/${a.id}`);
    expect(await retter(f)).toEqual([]);
    const ny = await lagRett(f, "Taco");
    expect((await retter(f)).find((r) => r.id === ny.id)).toMatchObject({ snitt: null, antall: 0 });
  });

  it("stjerner logges", async () => {
    const f = await agentFor(forelder, "9876");
    const h = await agentFor(haakon, "1234");
    const { id } = await lagRett(f, "Taco");
    await planlegg(f, "2026-10-06", id);
    await stjerner(h, "2026-10-06", 4);
    expect(
      db.prepare("SELECT user_id FROM audit_log WHERE handling = 'stjerner_gitt'").all(),
    ).toEqual([{ user_id: haakon }]);
  });
});

const first = (m: { minStjerner: number | null }) => m.minStjerner;

describe("flytting av middager som var lagt inn før retter fantes", () => {
  it("blir til retter, og ingen dager mister middagen sin", () => {
    const mappe = mkdtempSync(path.join(tmpdir(), "migrasjoner-"));
    const gamle = readdirSync(migrationsDir).filter((f) => f < "007");
    mkdirSync(mappe, { recursive: true });
    for (const f of gamle) copyFileSync(path.join(migrationsDir, f), path.join(mappe, f));
    const gammel = openDb(":memory:");
    migrate(gammel, mappe);
    gammel.prepare("INSERT INTO users (visningsnavn, rolle) VALUES ('Anita', 'forelder')").run();
    const sett = gammel.prepare(
      "INSERT INTO middag (dato, rett, notat, opprettet_av) VALUES (?, ?, ?, 1)",
    );
    sett.run("2026-10-05", "Taco", null);
    sett.run("2026-10-06", "Fiskekaker", "Husk å ta ut fisken");
    sett.run("2026-10-12", "taco", "Mild saus");
    gammel.prepare("INSERT INTO handleliste (navn, navn_norm) VALUES ('Melk', 'melk')").run();

    expect(migrate(gammel)).toEqual([
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
    const retterRader = gammel
      .prepare("SELECT tittel, notat, ingredienser FROM retter ORDER BY tittel")
      .all();
    expect(retterRader).toEqual([
      { tittel: "Fiskekaker", notat: "Husk å ta ut fisken", ingredienser: "[]" },
      { tittel: "Taco", notat: "Mild saus", ingredienser: "[]" },
    ]);
    const dager = gammel
      .prepare(
        "SELECT m.dato, m.rett, r.tittel FROM middag m JOIN retter r ON r.id = m.rett_id ORDER BY m.dato",
      )
      .all();
    expect(dager).toEqual([
      { dato: "2026-10-05", rett: "Taco", tittel: "Taco" },
      { dato: "2026-10-06", rett: "Fiskekaker", tittel: "Fiskekaker" },
      { dato: "2026-10-12", rett: "taco", tittel: "Taco" },
    ]);
    expect(gammel.prepare("SELECT navn, notat FROM handleliste").all()).toEqual([
      { navn: "Melk", notat: null },
    ]);
  });
});
