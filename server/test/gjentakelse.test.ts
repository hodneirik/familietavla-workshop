import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { loadConfig } from "../src/config.js";
import { flyttDager, mandagFor, nesteMaanedStart } from "../src/core/dato.js";
import { createLogger } from "../src/core/logger.js";
import { openDb, type Db } from "../src/db/client.js";
import { migrate } from "../src/db/migrate.js";
import { nesteGang } from "../src/modules/gjoremal/service.js";
import { createUser } from "../src/modules/users/service.js";

let db: Db;
let app: ReturnType<typeof createApp>;
let forelder: number;
let haakon: number;
let nelly: number;
let nå: number;

const klokka = (iso: string) => (nå = Date.parse(iso));

beforeEach(() => {
  nå = Date.parse("2026-10-07T10:00:00Z"); // onsdag
  db = openDb(":memory:");
  migrate(db);
  app = createApp({
    config: loadConfig({ SESSION_SECRET: "x".repeat(32), WEB_DIR: "/finnes-ikke" }),
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

describe("datohjelpere for gjentakelse", () => {
  it("finner mandagen i uka, også på en søndag", () => {
    expect(mandagFor("2026-10-07")).toBe("2026-10-05");
    expect(mandagFor("2026-10-05")).toBe("2026-10-05");
    expect(mandagFor("2026-10-11")).toBe("2026-10-05");
    expect(mandagFor("2026-01-01")).toBe("2025-12-29");
  });

  it("finner den første i neste måned, også over årsskifte", () => {
    expect(nesteMaanedStart("2026-10-07")).toBe("2026-11-01");
    expect(nesteMaanedStart("2026-12-31")).toBe("2027-01-01");
    expect(nesteMaanedStart("2026-01-31")).toBe("2026-02-01");
  });

  it("flytter både datoer og tidspunkt, og beholder klokkeslettet", () => {
    expect(flyttDager("2026-10-12T17:00", 7)).toBe("2026-10-19T17:00");
    expect(flyttDager("2026-10-12", 7)).toBe("2026-10-19");
    expect(flyttDager("2026-12-30T08:30", 7)).toBe("2027-01-06T08:30");
    expect(flyttDager("2026-03-23T02:30", 7)).toBe("2026-03-30T02:30"); // sommertid endrer ikke klokkeslettet
  });

  it("neste gang for et gjentakende gjøremål", () => {
    expect(nesteGang("daglig", "2026-10-07")).toBe("2026-10-08");
    expect(nesteGang("ukentlig", "2026-10-07")).toBe("2026-10-12");
    expect(nesteGang("ukentlig", "2026-10-11")).toBe("2026-10-12");
    expect(nesteGang("ukentlig", "2026-10-12")).toBe("2026-10-19");
    // Annenhver uke hopper over en hel uke, også over årsskiftet
    expect(nesteGang("annenhver_uke", "2026-10-07")).toBe("2026-10-19");
    expect(nesteGang("annenhver_uke", "2026-10-11")).toBe("2026-10-19");
    expect(nesteGang("annenhver_uke", "2026-12-30")).toBe("2027-01-11");
    expect(nesteGang("maanedlig", "2026-10-07")).toBe("2026-11-01");
  });
});

describe("gjentakende gjøremål", () => {
  const lag = async (f: Agent, gjentas: string | null, poeng = 10) => {
    const res = await f
      .post("/api/gjoremal")
      .send({ tittel: "Tømme oppvaskmaskinen", poeng, gjentas });
    expect(res.status).toBe(201);
    return res.body as { id: number; gjentas: string | null };
  };
  const gjorOgGodkjenn = async (f: Agent, b: Agent, id: number) => {
    expect((await b.post(`/api/gjoremal/${id}/ta`)).status).toBe(200);
    expect((await b.post(`/api/gjoremal/${id}/fullfor`)).status).toBe(200);
    return f.post(`/api/gjoremal/${id}/godkjenn`);
  };
  const liste = async (a: Agent) =>
    (await a.get("/api/gjoremal")).body as Array<{
      id: number;
      status: string;
      gjentas: string | null;
      ledigFra: string | null;
      tittel: string;
    }>;

  it("kan velges bare blant daglig, ukentlig og månedlig, og er valgfritt", async () => {
    const f = await agentFor(forelder, "9876");
    expect((await lag(f, null)).gjentas).toBeNull();
    expect((await lag(f, "ukentlig")).gjentas).toBe("ukentlig");
    expect((await f.post("/api/gjoremal").send({ tittel: "x" })).body.gjentas).toBeNull();
    for (const ugyldig of ["hver time", "", "Daglig", 7]) {
      expect(
        (await f.post("/api/gjoremal").send({ tittel: "x", gjentas: ugyldig })).status,
        String(ugyldig),
      ).toBe(400);
    }
  });

  it("bare forelder kan sette og endre gjentakelsen, og den kan slås av igjen", async () => {
    const f = await agentFor(forelder, "9876");
    const h = await agentFor(haakon, "1234");
    const { id } = await lag(f, null);
    expect((await h.patch(`/api/gjoremal/${id}`).send({ gjentas: "daglig" })).status).toBe(403);
    expect((await f.patch(`/api/gjoremal/${id}`).send({ gjentas: "daglig" })).body.gjentas).toBe(
      "daglig",
    );
    // Å endre bare tittelen rører ikke gjentakelsen
    expect((await f.patch(`/api/gjoremal/${id}`).send({ tittel: "Nytt navn" })).body.gjentas).toBe(
      "daglig",
    );
    expect((await f.patch(`/api/gjoremal/${id}`).send({ gjentas: null })).body.gjentas).toBeNull();
  });

  it("et vanlig gjøremål blir godkjent og forblir godkjent, som før", async () => {
    const f = await agentFor(forelder, "9876");
    const h = await agentFor(haakon, "1234");
    const { id } = await lag(f, null);
    const res = await gjorOgGodkjenn(f, h, id);
    expect(res.body).toMatchObject({ id, status: "godkjent", gjentas: null });
    expect((await liste(h)).filter((g) => g.status === "ledig")).toEqual([]);
  });

  it("et daglig gjøremål gir poeng, havner i historikken og hviler til i morgen", async () => {
    const f = await agentFor(forelder, "9876");
    const h = await agentFor(haakon, "1234");
    const m = await agentFor(nelly, "5678");
    const { id } = await lag(f, "daglig");
    const res = await gjorOgGodkjenn(f, h, id);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      status: "godkjent",
      gjentas: null,
      tittel: "Tømme oppvaskmaskinen",
    });
    expect(res.body.id).not.toBe(id); // godkjent kopi i historikken
    expect((await h.get("/api/gjoremal/poeng")).body[0].poeng).toBe(10);

    // Barna ser det ikke før i morgen, bare den godkjente kopien
    expect((await liste(m)).map((g) => g.status)).toEqual(["godkjent"]);
    expect((await m.post(`/api/gjoremal/${id}/ta`)).status).toBe(409);
    // Foreldre ser at det hviler, og når det kommer tilbake
    const forelderSerDet = (await liste(f)).find((g) => g.id === id)!;
    expect(forelderSerDet).toMatchObject({
      status: "ledig",
      gjentas: "daglig",
      ledigFra: "2026-10-08",
    });

    klokka("2026-10-08T05:00:00Z");
    const igjen = (await liste(m)).find((g) => g.id === id)!;
    expect(igjen).toMatchObject({ status: "ledig", gjentas: "daglig" });
    expect((await m.post(`/api/gjoremal/${id}/ta`)).status).toBe(200);
  });

  it("midnatt følger norsk tid, ikke UTC", async () => {
    const f = await agentFor(forelder, "9876");
    const h = await agentFor(haakon, "1234");
    const { id } = await lag(f, "daglig");
    klokka("2026-10-07T21:30:00Z"); // 23:30 onsdag i Norge
    await gorOgGodkjennNår(f, h, id);
    klokka("2026-10-07T22:30:00Z"); // 00:30 torsdag i Norge
    expect((await liste(h)).find((g) => g.id === id)!.status).toBe("ledig");

    async function gorOgGodkjennNår(a: Agent, b: Agent, gid: number) {
      await gorOgGodkjenn(a, b, gid);
    }
    function gorOgGodkjenn(a: Agent, b: Agent, gid: number) {
      return gjorOgGodkjenn(a, b, gid);
    }
  });

  it("et ukentlig gjøremål er ledig igjen fra mandag, og et månedlig fra den første", async () => {
    const f = await agentFor(forelder, "9876");
    const h = await agentFor(haakon, "1234");
    const uke = await lag(f, "ukentlig");
    const maaned = await lag(f, "maanedlig");
    await gjorOgGodkjenn(f, h, uke.id); // onsdag 7. oktober
    await gjorOgGodkjenn(f, h, maaned.id);
    const sett = (await liste(f)).filter((g) => g.ledigFra);
    expect(sett.find((g) => g.id === uke.id)!.ledigFra).toBe("2026-10-12");
    expect(sett.find((g) => g.id === maaned.id)!.ledigFra).toBe("2026-11-01");

    klokka("2026-10-11T10:00:00Z"); // søndag
    expect((await liste(h)).some((g) => g.id === uke.id)).toBe(false);
    klokka("2026-10-12T08:00:00Z"); // mandag
    expect((await liste(h)).some((g) => g.id === uke.id)).toBe(true);
    expect((await liste(h)).some((g) => g.id === maaned.id)).toBe(false);
    klokka("2026-11-01T08:00:00Z");
    expect((await liste(h)).some((g) => g.id === maaned.id)).toBe(true);
  });

  it("et annenhver-uke-gjøremål hopper over en hel uke", async () => {
    const f = await agentFor(forelder, "9876");
    const h = await agentFor(haakon, "1234");
    const { id, gjentas } = await lag(f, "annenhver_uke");
    expect(gjentas).toBe("annenhver_uke");
    await gjorOgGodkjenn(f, h, id); // onsdag 7. oktober
    expect((await liste(f)).find((g) => g.id === id)!.ledigFra).toBe("2026-10-19");
    klokka("2026-10-12T08:00:00Z"); // mandagen i uka etter: fortsatt hvile
    expect((await liste(h)).some((g) => g.id === id)).toBe(false);
    klokka("2026-10-18T22:00:00Z"); // søndag kveld UTC er allerede mandag natt i norsk tid
    expect((await liste(h)).some((g) => g.id === id)).toBe(true);
    klokka("2026-10-18T10:00:00Z");
    expect((await liste(h)).some((g) => g.id === id)).toBe(false);
  });

  it("poengene teller hver runde, og historikken viser hver gang", async () => {
    const f = await agentFor(forelder, "9876");
    const h = await agentFor(haakon, "1234");
    const { id } = await lag(f, "daglig", 5);
    for (const dato of ["2026-10-07", "2026-10-08", "2026-10-09"]) {
      klokka(`${dato}T10:00:00Z`);
      expect((await gjorOgGodkjenn(f, h, id)).status, dato).toBe(200);
    }
    expect((await h.get("/api/gjoremal/poeng")).body[0].poeng).toBe(15);
    expect((await liste(f)).filter((g) => g.status === "godkjent")).toHaveLength(3);
    expect(db.prepare("SELECT COUNT(*) AS n FROM poeng_logg").get()).toEqual({ n: 3 });
  });

  it("det kan bare gjøres én gang per runde, og to barn kan ikke ta det samtidig", async () => {
    const f = await agentFor(forelder, "9876");
    const h = await agentFor(haakon, "1234");
    const m = await agentFor(nelly, "5678");
    const { id } = await lag(f, "ukentlig");
    await h.post(`/api/gjoremal/${id}/ta`);
    expect((await m.post(`/api/gjoremal/${id}/ta`)).status).toBe(409);
    await h.post(`/api/gjoremal/${id}/fullfor`);
    await f.post(`/api/gjoremal/${id}/godkjenn`);
    expect((await f.post(`/api/gjoremal/${id}/godkjenn`)).status).toBe(409);
    expect((await h.post(`/api/gjoremal/${id}/ta`)).status).toBe(409);
  });

  it("slås gjentakelsen av mens det hviler, er det ledig med en gang", async () => {
    const f = await agentFor(forelder, "9876");
    const h = await agentFor(haakon, "1234");
    const { id } = await lag(f, "maanedlig");
    await gjorOgGodkjenn(f, h, id);
    expect((await h.post(`/api/gjoremal/${id}/ta`)).status).toBe(409);
    await f.patch(`/api/gjoremal/${id}`).send({ gjentas: null });
    expect((await h.post(`/api/gjoremal/${id}/ta`)).status).toBe(200);
  });

  it("slettes gjøremålet, blir poengene og historikken stående", async () => {
    const f = await agentFor(forelder, "9876");
    const h = await agentFor(haakon, "1234");
    const { id } = await lag(f, "daglig");
    await gjorOgGodkjenn(f, h, id);
    expect((await f.delete(`/api/gjoremal/${id}`)).status).toBe(204);
    expect((await h.get("/api/gjoremal/poeng")).body[0].poeng).toBe(10);
    expect((await liste(h)).map((g) => g.status)).toEqual(["godkjent"]);
  });
});

describe("avtaler som gjentas hver uke", () => {
  const ny = async (f: Agent, ekstra: Record<string, unknown> = {}) => {
    const res = await f.post("/api/kalender/hendelser").send({
      kalenderId: 1,
      tittel: "Fotballtrening",
      helDag: false,
      start: "2026-10-06T17:00",
      slutt: "2026-10-06T18:30",
      gjentas: "ukentlig",
      gjentasTil: "2026-10-27",
      ...ekstra,
    });
    return res;
  };
  const hent = async (a: Agent, fra: string, til: string) =>
    (await a.get(`/api/kalender/hendelser?fra=${fra}&til=${til}`)).body as Array<{
      id: number;
      start: string;
      slutt: string;
      gjentas: string | null;
      gjentasTil: string | null;
      startOriginal: string;
      sluttOriginal: string;
    }>;

  it("skrives ut som én forekomst per uke til og med sluttdatoen", async () => {
    const f = await agentFor(forelder, "9876");
    expect((await ny(f)).status).toBe(201);
    const alle = await hent(f, "2026-10-01", "2026-11-30");
    expect(alle.map((h) => h.start)).toEqual([
      "2026-10-06T17:00",
      "2026-10-13T17:00",
      "2026-10-20T17:00",
      "2026-10-27T17:00",
    ]);
    expect(alle[3]).toMatchObject({
      slutt: "2026-10-27T18:30",
      gjentas: "ukentlig",
      gjentasTil: "2026-10-27",
      startOriginal: "2026-10-06T17:00",
      sluttOriginal: "2026-10-06T18:30",
    });
  });

  it("alle ser forekomstene, og bare tidsrommet som spørres om kommer med", async () => {
    const f = await agentFor(forelder, "9876");
    const h = await agentFor(haakon, "1234");
    await ny(f);
    expect((await hent(h, "2026-10-12", "2026-10-19")).map((x) => x.start)).toEqual([
      "2026-10-13T17:00",
    ]);
    expect(await hent(h, "2026-10-14", "2026-10-20")).toEqual([]);
    expect(await hent(h, "2026-10-28", "2026-11-30")).toEqual([]);
    expect(await hent(h, "2026-09-01", "2026-10-06")).toEqual([]);
  });

  it("serien finnes også når den begynte lenge før tidsrommet", async () => {
    const f = await agentFor(forelder, "9876");
    await ny(f, { start: "2026-01-06T17:00", slutt: "2026-01-06T18:00", gjentasTil: "2026-12-29" });
    const uke = await hent(f, "2026-10-12", "2026-10-19");
    expect(uke.map((h) => h.start)).toEqual(["2026-10-13T17:00"]);
    expect(uke[0]!.startOriginal).toBe("2026-01-06T17:00");
  });

  it("virker for hele dager og for avtaler over flere dager", async () => {
    const f = await agentFor(forelder, "9876");
    await ny(f, {
      tittel: "Helg hos bestemor",
      helDag: true,
      start: "2026-10-10",
      slutt: "2026-10-11",
      gjentasTil: "2026-10-24",
    });
    const alle = await hent(f, "2026-10-01", "2026-11-01");
    expect(alle.map((h) => [h.start, h.slutt])).toEqual([
      ["2026-10-10T00:00", "2026-10-12T00:00"],
      ["2026-10-17T00:00", "2026-10-19T00:00"],
      ["2026-10-24T00:00", "2026-10-26T00:00"],
    ]);
    // Søndagen i midten av en helg regnes med
    expect((await hent(f, "2026-10-18", "2026-10-19")).map((h) => h.start)).toEqual([
      "2026-10-17T00:00",
    ]);
  });

  it("vanlige avtaler og serier blandes og sorteres etter start", async () => {
    const f = await agentFor(forelder, "9876");
    await ny(f, { gjentasTil: "2026-10-13" });
    await f.post("/api/kalender/hendelser").send({
      kalenderId: 1,
      tittel: "Tannlege",
      helDag: false,
      start: "2026-10-13T08:00",
      slutt: "2026-10-13T09:00",
    });
    const rader = await hent(f, "2026-10-12", "2026-10-14");
    expect(rader.map((h) => h.start)).toEqual(["2026-10-13T08:00", "2026-10-13T17:00"]);
    expect(rader.map((h) => h.gjentas)).toEqual([null, "ukentlig"]);
  });

  it("sluttdato er påkrevd og må være gyldig, ikke før starten og innen to år", async () => {
    const f = await agentFor(forelder, "9876");
    expect((await ny(f, { gjentasTil: null })).status).toBe(400);
    expect((await ny(f, { gjentasTil: "i morgen" })).status).toBe(400);
    expect((await ny(f, { gjentasTil: "2026-10-05" })).status).toBe(400);
    expect((await ny(f, { gjentasTil: "2028-12-31" })).status).toBe(400);
    expect((await ny(f, { gjentas: "daglig" })).status).toBe(400);
    expect((await ny(f, { gjentasTil: "2026-10-06" })).status).toBe(201); // én forekomst er greit
  });

  it("uten gjentakelse lagres ingen sluttdato, selv om en er sendt med", async () => {
    const f = await agentFor(forelder, "9876");
    const res = await ny(f, { gjentas: null, gjentasTil: "2026-12-01" });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ gjentas: null, gjentasTil: null });
    expect(await hent(f, "2026-10-01", "2026-12-31")).toHaveLength(1);
  });

  it("endring og sletting gjelder hele serien, og bare voksne kan gjøre det", async () => {
    const f = await agentFor(forelder, "9876");
    const h = await agentFor(haakon, "1234");
    const { id } = (await ny(f)).body as { id: number };
    const avtale = {
      kalenderId: 1,
      tittel: "Fotball, ny tid",
      helDag: false,
      start: "2026-10-06T18:00",
      slutt: "2026-10-06T19:00",
      gjentas: "ukentlig",
      gjentasTil: "2026-10-20",
    };
    expect((await h.put(`/api/kalender/hendelser/${id}`).send(avtale)).status).toBe(403);
    expect((await h.delete(`/api/kalender/hendelser/${id}`)).status).toBe(403);
    expect((await f.put(`/api/kalender/hendelser/${id}`).send(avtale)).status).toBe(200);
    expect((await hent(f, "2026-10-01", "2026-11-30")).map((x) => x.start)).toEqual([
      "2026-10-06T18:00",
      "2026-10-13T18:00",
      "2026-10-20T18:00",
    ]);
    // Gjentakelsen kan slås av
    await f
      .put(`/api/kalender/hendelser/${id}`)
      .send({ ...avtale, gjentas: null, gjentasTil: null });
    expect(await hent(f, "2026-10-01", "2026-11-30")).toHaveLength(1);
    await f.put(`/api/kalender/hendelser/${id}`).send(avtale);
    expect((await f.delete(`/api/kalender/hendelser/${id}`)).status).toBe(204);
    expect(await hent(f, "2026-10-01", "2026-11-30")).toEqual([]);
  });

  it("klokkeslettet er det samme på begge sider av sommertidsskiftet", async () => {
    const f = await agentFor(forelder, "9876");
    await ny(f, { start: "2026-10-20T17:00", slutt: "2026-10-20T18:00", gjentasTil: "2026-11-10" });
    const tider = (await hent(f, "2026-10-01", "2026-12-01")).map((h) => h.start.slice(11));
    expect(tider).toEqual(["17:00", "17:00", "17:00", "17:00"]);
  });
});
