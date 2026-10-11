import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { loadConfig } from "../src/config.js";
import { createLogger } from "../src/core/logger.js";
import { openDb, type Db } from "../src/db/client.js";
import { migrate } from "../src/db/migrate.js";
import type { KiForesporsel, KiKlient, KiResultat } from "../src/modules/ki/klient.js";
import { createUser } from "../src/modules/users/service.js";

let db: Db;
let nå: number;
let forelder: number;
let kiSvar: (f: KiForesporsel) => Promise<KiResultat>;
let kall: KiForesporsel[];
let app: ReturnType<typeof createApp>;

// «I dag» er onsdag 7. oktober 2026
const FRA = "2026-10-07";
const TIL = "2026-10-11";

const dag = (dato: string, o: object = {}) => ({
  dato,
  rett: null,
  nyTittel: null,
  nyIngredienser: [],
  gjenbruk: [],
  begrunnelse: "Passer fint",
  ...o,
});
const svar = (dager: object[], over: object = {}) => ({
  sammendrag: "En rolig uke.",
  dager,
  advarsler: [],
  ...over,
});
const resultat = (s: unknown): KiResultat => ({
  tekst: JSON.stringify(s),
  stopReason: "end_turn",
  forbruk: { inputTokens: 3000, cacheSkrivTokens: 0, cacheLesTokens: 0, outputTokens: 800 },
  requestId: "req_middag",
  modell: "claude-sonnet-5-5",
});

beforeEach(() => {
  nå = Date.parse("2026-10-07T10:00:00Z");
  db = openDb(":memory:");
  migrate(db);
  kall = [];
  kiSvar = async () => resultat(svar([]));
  const klient: KiKlient = {
    kjor: async (f) => {
      kall.push(f);
      return kiSvar(f);
    },
  };
  app = createApp({
    config: loadConfig({
      SESSION_SECRET: "x".repeat(32),
      WEB_DIR: "/finnes-ikke",
      ANTHROPIC_API_KEY: "sk-ant-TESTNOKKEL-1234567890",
    }),
    db,
    log: createLogger("error"),
    naa: () => nå,
    kiKlient: klient,
  });
  forelder = createUser(db, { visningsnavn: "Anita", rolle: "forelder", pin: "9876" }, null).id;
  createUser(db, { visningsnavn: "Elias", rolle: "barn", pin: "1234" }, null);
});

async function somForelder() {
  const agent = request.agent(app);
  expect((await agent.post("/api/auth/login").send({ userId: forelder, pin: "9876" })).status).toBe(
    200,
  );
  return agent;
}
type Agent = Awaited<ReturnType<typeof somForelder>>;

const lagRett = async (f: Agent, tittel: string, ingredienser: string[] = []) =>
  (await f.post("/api/middag/retter").send({ tittel, ingredienser })).body.id as number;

async function ventJobb(f: Agent, jobbId: string) {
  for (let i = 0; i < 200; i++) {
    const res = await f.get(`/api/ki/jobber/${jobbId}`);
    if (res.body.status !== "venter") return res.body;
    await new Promise((r) => setTimeout(r, 5));
  }
  throw new Error("Jobben ble aldri ferdig");
}
async function foresla(f: Agent, over: object = {}) {
  const res = await f.post("/api/ki/middag/foresla").send({ fra: FRA, til: TIL, ...over });
  expect(res.status, JSON.stringify(res.body)).toBe(202);
  return ventJobb(f, res.body.jobbId as string);
}
const antall = (tabell: string) =>
  (db.prepare(`SELECT COUNT(*) AS n FROM ${tabell}`).get() as { n: number }).n;

describe("KI: middagsforslag", () => {
  it("sender retter, score og ledige dager til KI-en uten PDF og uten navn, og skriver ingenting", async () => {
    const f = await somForelder();
    const taco = await lagRett(f, "Tacofredag");
    await lagRett(f, "Eliass pasta");
    await f.put(`/api/middag/${FRA}`).send({ rettId: taco, ingredienser: [] });
    kiSvar = async () => resultat(svar([dag("2026-10-08", { rett: "R2" })]));
    const jobb = await foresla(f, { onsker: "Elias vil ha fisk" });
    expect(jobb.status).toBe("ferdig");

    const k = kall[0]!;
    expect(k.pdfBase64).toBeUndefined();
    expect(k.kontekst).toContain('alias="R1"');
    expect(k.kontekst).toContain("Tacofredag");
    expect(k.kontekst).toContain("ingen stemmer ennå");
    // Dagen som allerede har middag, foreslås det ikke for
    expect(k.kontekst).not.toContain('<dag dato="2026-10-07"');
    expect(k.kontekst).toContain('<dag dato="2026-10-08"');
    expect(k.kontekst).toContain("fisk");
    expect(k.kontekst).not.toContain("Elias");
    expect(k.kontekst).toContain("barn A");
    expect(k.effort).toBe("low");

    // Ingenting er lagret ut over det som var der fra før
    expect(antall("middag")).toBe(1);
    expect(antall("retter")).toBe(2);
    expect(antall("handleliste")).toBe(0);
    expect(db.prepare("SELECT formaal, status FROM ki_logg").all()).toEqual([
      { formaal: "middag", status: "ok" },
    ]);
  });

  it("gir forslag med eksisterende og nye retter, og renser alt som er ugyldig", async () => {
    const f = await somForelder();
    await lagRett(f, "Taco");
    await lagRett(f, "Laks", ["laks", "poteter"]);
    kiSvar = async () =>
      resultat(
        svar([
          dag("2026-10-08", { rett: "R2", begrunnelse: "Se www.farlig.no for oppskrift" }),
          dag("2026-10-09", {
            nyTittel: "Fiskesuppe",
            nyIngredienser: ["fisk", "Fisk", "løk", "http://x.no"],
          }),
          dag("2026-10-10", { nyTittel: "taco" }),
          dag("2026-10-10", { rett: "R1" }),
          dag("2027-01-01", { rett: "R1" }),
          dag("2026-10-11", { rett: "R9" }),
        ]),
      );
    const jobb = await foresla(f);
    const forslag = jobb.resultat.forslag;
    expect(
      forslag.dager.map((d: { dato: string; tittel: string; ny: boolean }) => [
        d.dato,
        d.tittel,
        d.ny,
      ]),
    ).toEqual([
      ["2026-10-08", "Laks", false],
      ["2026-10-09", "Fiskesuppe", true],
      ["2026-10-10", "Taco", false],
    ]);
    expect(forslag.dager[0].begrunnelse).toBe("");
    expect(forslag.dager[1].ingredienser).toEqual(["fisk", "løk"]);
    expect(forslag.forkastet).toBe(3);
  });

  it("avviser feil tidsrom og dager uten ledige plasser før noe koster penger", async () => {
    const f = await somForelder();
    const post = (b: object) => f.post("/api/ki/middag/foresla").send(b);
    expect((await post({ fra: "2026-10-01", til: "2026-10-05" })).status).toBe(400);
    expect((await post({ fra: TIL, til: FRA })).status).toBe(400);
    expect((await post({ fra: FRA, til: "2026-10-30" })).status).toBe(400);
    expect((await post({ fra: "i morgen", til: TIL })).status).toBe(400);
    const r = await lagRett(f, "Taco");
    for (const d of ["2026-10-07", "2026-10-08"])
      await f.put(`/api/middag/${d}`).send({ rettId: r, ingredienser: [] });
    expect((await post({ fra: FRA, til: "2026-10-08" })).status).toBe(400);
    expect(kall).toHaveLength(0);
  });

  it("logger kostnaden også når svaret ikke kan brukes, og skriver ingenting", async () => {
    const f = await somForelder();
    await lagRett(f, "Taco");
    kiSvar = async () => ({ ...resultat("{ikke json"), tekst: "{ikke json" });
    const jobb = await foresla(f);
    expect(jobb.status).toBe("feil");
    expect(db.prepare("SELECT status FROM ki_logg").all()).toEqual([{ status: "ugyldig_svar" }]);
    expect(antall("middag")).toBe(0);
  });
});

describe("KI: legg inn middag", () => {
  it("planlegger dagene, lager nye retter, og legger ikke ingredienser på handlelista uten at det er valgt", async () => {
    const f = await somForelder();
    const laks = await lagRett(f, "Laks", ["laks", "poteter"]);
    const res = await f.post("/api/ki/middag/legg-inn").send({
      dager: [
        { forslagId: "m1", dato: "2026-10-08", rettId: laks },
        {
          forslagId: "m2",
          dato: "2026-10-09",
          ny: { tittel: "Fiskesuppe", ingredienser: ["fisk", "løk"] },
        },
      ],
    });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ antallOk: 2, nyeRetter: 1 });
    expect(db.prepare("SELECT dato, rett FROM middag ORDER BY dato").all()).toEqual([
      { dato: "2026-10-08", rett: "Laks" },
      { dato: "2026-10-09", rett: "Fiskesuppe" },
    ]);
    expect(db.prepare("SELECT ingredienser FROM retter WHERE tittel = 'Fiskesuppe'").get()).toEqual(
      {
        ingredienser: JSON.stringify(["fisk", "løk"]),
      },
    );
    expect(antall("handleliste")).toBe(0);
  });

  it("legger ingrediensene på handlelista når forelderen ber om det", async () => {
    const f = await somForelder();
    const laks = await lagRett(f, "Laks", ["laks", "poteter"]);
    await f
      .post("/api/ki/middag/legg-inn")
      .send({ dager: [{ dato: "2026-10-08", rettId: laks }], paaHandleliste: true });
    expect(db.prepare("SELECT navn FROM handleliste ORDER BY navn").all()).toEqual([
      { navn: "Laks" },
      { navn: "Poteter" },
    ]);
  });

  it("rører ikke en dag som har fått middag i mellomtiden, og avviser dager før i dag", async () => {
    const f = await somForelder();
    const taco = await lagRett(f, "Taco");
    const laks = await lagRett(f, "Laks");
    await f.put("/api/middag/2026-10-08").send({ rettId: taco, ingredienser: [] });
    const res = await f.post("/api/ki/middag/legg-inn").send({
      dager: [
        { forslagId: "m1", dato: "2026-10-08", rettId: laks },
        { forslagId: "m2", dato: "2026-10-01", rettId: laks },
        { forslagId: "m3", dato: "2026-10-09", rettId: laks },
      ],
    });
    expect(
      res.body.rader.map((r: { ok: boolean; feil?: string }) => [r.ok, r.feil ?? null]),
    ).toEqual([
      [false, "Dagen har allerede middag"],
      [false, "Ugyldig dato"],
      [true, null],
    ]);
    expect(db.prepare("SELECT dato, rett FROM middag ORDER BY dato").all()).toEqual([
      { dato: "2026-10-08", rett: "Taco" },
      { dato: "2026-10-09", rett: "Laks" },
    ]);
  });

  it("bruker en rett som finnes i stedet for å lage en dublett, og avviser tomme valg", async () => {
    const f = await somForelder();
    await lagRett(f, "Taco");
    const res = await f.post("/api/ki/middag/legg-inn").send({
      dager: [
        { dato: "2026-10-08", ny: { tittel: "taco", ingredienser: [] } },
        { dato: "2026-10-09" },
      ],
    });
    expect(res.body.rader.map((r: { ok: boolean }) => r.ok)).toEqual([true, false]);
    expect(antall("retter")).toBe(1);
  });
});

describe("KI: middag og matsvinn", () => {
  it("forteller hvem som spiser og hva rettene inneholder, og følger innstillingen for voksne", async () => {
    const f = await somForelder();
    await lagRett(f, "Taco", ["400 g kjøttdeig", "1 stk salat", "1 pk tortilla"]);
    kiSvar = async () => resultat(svar([]));
    await foresla(f);
    expect(kall[0]!.kontekst).toContain('<husstand voksne="1" barn="1"/>');
    expect(kall[0]!.kontekst).toContain('ingredienser="kjøttdeig, salat, tortilla"');
    expect(kall[0]!.system).toContain("barn");
    expect(kall[0]!.system).toContain("matsvinn");

    const put = await f
      .put("/api/ki/innstillinger")
      .send({ barn: [], regler: "", standardKalenderId: null, voksne: 2 });
    expect(put.status).toBe(200);
    await foresla(f);
    expect(kall[1]!.kontekst).toContain('<husstand voksne="2" barn="1"/>');
    for (const voksne of [0, 9, 1.5]) {
      const res = await f
        .put("/api/ki/innstillinger")
        .send({ barn: [], regler: "", standardKalenderId: null, voksne });
      expect(res.status).toBe(400);
    }
  });

  it("bruker samme skrivemåte på ingredienser som familien har fra før, og beholder mengden", async () => {
    const f = await somForelder();
    await lagRett(f, "Taco", ["1 stk Isbergsalat", "400 g kjøttdeig"]);
    kiSvar = async () =>
      resultat(
        svar([
          dag("2026-10-08", {
            nyTittel: "Wraps",
            nyIngredienser: [
              "2 stk isbergsalat",
              "ISBERGSALAT",
              "300 g Kjøttdeig",
              "1 pk tortilla",
            ],
            gjenbruk: ["Salat", "http://farlig.no"],
          }),
        ]),
      );
    const jobb = await foresla(f);
    const d = jobb.resultat.forslag.dager[0];
    expect(d.ingredienser).toEqual(["2 stk Isbergsalat", "300 g kjøttdeig", "1 pk tortilla"]);
    expect(d.gjenbruk).toEqual(["Salat"]);
  });
});

describe("KI: regler for middag", () => {
  it("sender reglene for middag, men ikke reglene for ukeplanen (skole, gym, turdager)", async () => {
    const f = await somForelder();
    await lagRett(f, "Taco", ["400 g kjøttdeig"]);
    const put = await f.put("/api/ki/innstillinger").send({
      barn: [],
      regler: "Legg gym og turdager i kalenderen",
      middagRegler: "Ingen sopp. Fisk minst én gang i uka.",
      standardKalenderId: null,
    });
    expect(put.status).toBe(200);
    expect(put.body).toMatchObject({
      regler: "Legg gym og turdager i kalenderen",
      middagRegler: "Ingen sopp. Fisk minst én gang i uka.",
    });
    await foresla(f);
    const k = kall[0]!;
    expect(k.kontekst).toContain("Ingen sopp");
    expect(k.kontekst).not.toContain("turdager");
    expect(k.system).toContain("Skriv aldri om skole");
    // Uten middagRegler i en senere lagring beholdes det som står
    await f.put("/api/ki/innstillinger").send({ barn: [], regler: "", standardKalenderId: null });
    expect((await f.get("/api/ki/innstillinger")).body.middagRegler).toBe(
      "Ingen sopp. Fisk minst én gang i uka.",
    );
    expect(
      (
        await f.put("/api/ki/innstillinger").send({
          barn: [],
          regler: "",
          standardKalenderId: null,
          middagRegler: "x".repeat(1001),
        })
      ).status,
    ).toBe(400);
  });
});
