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

const ret = (
  tittel: string,
  ingredienser: string[] = ["a", "b", "c"],
  notat: string | null = null,
) => ({
  tittel,
  notat,
  ingredienser,
});
const svar = (retter: object[], over: object = {}) => ({
  sammendrag: "Enkle fiskeretter.",
  retter,
  advarsler: [],
  ...over,
});

async function ventJobb2(f: Agent, jobbId: string) {
  for (let i = 0; i < 200; i++) {
    const res = await f.get(`/api/ki/jobber/${jobbId}`);
    if (res.body.status !== "venter") return res.body;
    await new Promise((r) => setTimeout(r, 5));
  }
  throw new Error("Jobben ble aldri ferdig");
}
async function foresla(f: Agent, over: object = {}) {
  const res = await f.post("/api/ki/retter/foresla").send({ onsker: "", antall: 5, ...over });
  expect(res.status, JSON.stringify(res.body)).toBe(202);
  return ventJobb2(f, res.body.jobbId as string);
}
const antall = (tabell: string) =>
  (db.prepare(`SELECT COUNT(*) AS n FROM ${tabell}`).get() as { n: number }).n;

describe("KI: lag retter", () => {
  it("sender ønsker og eksisterende retter uten PDF og uten navn, og skriver ingenting", async () => {
    const f = await somForelder();
    await f.post("/api/middag/retter").send({ tittel: "Eliass pasta", ingredienser: [] });
    kiSvar = async () => resultat(svar([ret("Fiskegrateng")]));
    const jobb = await foresla(f, {
      onsker: "Raske fiskeretter, Elias liker ikke sopp",
      antall: 3,
    });
    expect(jobb.status).toBe("ferdig");
    const k = kall[0]!;
    expect(k.pdfBase64).toBeUndefined();
    expect(k.kontekst).toContain("<antall>3</antall>");
    expect(k.kontekst).toContain("<rett>barn A sin pasta</rett>");
    expect(k.kontekst).toContain("fiskeretter");
    expect(k.kontekst).not.toContain("Elias");
    expect(antall("retter")).toBe(1);
    expect(db.prepare("SELECT formaal, status FROM ki_logg").all()).toEqual([
      { formaal: "middag", status: "ok" },
    ]);
  });

  it("renser: dubletter, retter som finnes, for mange, lenker og dobbelte ingredienser", async () => {
    const f = await somForelder();
    await f.post("/api/middag/retter").send({ tittel: "Taco", ingredienser: [] });
    kiSvar = async () =>
      resultat(
        svar([
          ret("taco"),
          ret("Fiskegrateng", ["fisk", "Fisk", "fløte", "http://x.no"], "Se www.farlig.no"),
          ret("Fiskegrateng"),
          ret("Lasagne"),
          ret("Pannekaker"),
          ret("Suppe www.x.no"),
        ]),
      );
    const jobb = await foresla(f, { antall: 2 });
    const forslag = jobb.resultat.forslag;
    expect(forslag.retter.map((r: { tittel: string }) => r.tittel)).toEqual([
      "Fiskegrateng",
      "Lasagne",
    ]);
    expect(forslag.retter[0].ingredienser).toEqual(["fisk", "fløte"]);
    expect(forslag.retter[0].notat).toBeNull();
    expect(forslag.forkastet).toBe(4);
  });

  it("avviser ugyldig antall før noe koster penger", async () => {
    const f = await somForelder();
    for (const antall of [0, 11, 2.5]) {
      expect((await f.post("/api/ki/retter/foresla").send({ antall })).status).toBe(400);
    }
    expect(kall).toHaveLength(0);
  });

  it("logger kostnaden når svaret ikke kan brukes", async () => {
    const f = await somForelder();
    kiSvar = async () => ({ ...resultat("x"), tekst: "{ikke json" });
    expect((await foresla(f)).status).toBe("feil");
    expect(db.prepare("SELECT status FROM ki_logg").all()).toEqual([{ status: "ugyldig_svar" }]);
  });
});

describe("KI: legg inn retter", () => {
  it("lager rettene, og hopper over en som finnes fra før", async () => {
    const f = await somForelder();
    await f.post("/api/middag/retter").send({ tittel: "Taco", ingredienser: [] });
    const res = await f.post("/api/ki/retter/legg-inn").send({
      retter: [
        {
          forslagId: "r1",
          tittel: "Fiskegrateng",
          notat: "Ta ut fisken",
          ingredienser: ["fisk", "fløte"],
        },
        { forslagId: "r2", tittel: "taco", ingredienser: [] },
        { forslagId: "r3", tittel: "  ", ingredienser: [] },
      ],
    });
    expect(res.status).toBe(200);
    expect(res.body.antallOk).toBe(1);
    expect(res.body.rader.map((r: { ok: boolean }) => r.ok)).toEqual([true, false, false]);
    expect(db.prepare("SELECT tittel, notat, ingredienser FROM retter ORDER BY id").all()).toEqual([
      { tittel: "Taco", notat: null, ingredienser: "[]" },
      {
        tittel: "Fiskegrateng",
        notat: "Ta ut fisken",
        ingredienser: JSON.stringify(["fisk", "fløte"]),
      },
    ]);
    expect(antall("handleliste")).toBe(0);
  });

  it("avviser tom liste og for mange", async () => {
    const f = await somForelder();
    expect((await f.post("/api/ki/retter/legg-inn").send({ retter: [] })).status).toBe(400);
    expect(
      (
        await f
          .post("/api/ki/retter/legg-inn")
          .send({ retter: Array.from({ length: 11 }, (_, i) => ({ tittel: `R${i}` })) })
      ).status,
    ).toBe(400);
  });
});

describe("KI: retter med mengder og felles ingredienser", () => {
  it("forteller hvem som spiser og hvilke ingredienser som brukes fra før, og ber om barnevennlig mat", async () => {
    const f = await somForelder();
    await f
      .post("/api/middag/retter")
      .send({ tittel: "Taco", ingredienser: ["400 g kjøttdeig", "1 stk Isbergsalat"] });
    kiSvar = async () => resultat(svar([]));
    await foresla(f);
    const k = kall[0]!;
    expect(k.kontekst).toContain('<husstand voksne="1" barn="1"/>');
    expect(k.kontekst).toContain("<ingrediens>kjøttdeig</ingrediens>");
    expect(k.kontekst).toContain("<ingrediens>Isbergsalat</ingrediens>");
    expect(k.system).toContain("barnevennlige");
    expect(k.system).toContain("mengde");
    expect(k.system).toContain("matsvinn");
  });

  it("bytter til skrivemåten familien bruker, slår sammen like varer og beholder mengden", async () => {
    const f = await somForelder();
    await f
      .post("/api/middag/retter")
      .send({ tittel: "Taco", ingredienser: ["1 stk Isbergsalat"] });
    kiSvar = async () =>
      resultat(
        svar([
          ret("Wraps", ["2 stk isbergsalat", "isbergsalat", "200 g kylling", "1 pk tortilla"]),
        ]),
      );
    const jobb = await foresla(f, { antall: 1 });
    expect(jobb.resultat.forslag.retter[0].ingredienser).toEqual([
      "2 stk Isbergsalat",
      "200 g kylling",
      "1 pk tortilla",
    ]);
  });
});

describe("KI: regler for middag i retter", () => {
  it("sender bare reglene for middag, ikke reglene for ukeplanen", async () => {
    const f = await somForelder();
    await f.put("/api/ki/innstillinger").send({
      barn: [],
      regler: "Legg gym og turdager i kalenderen",
      middagRegler: "Ingen sopp",
      standardKalenderId: null,
    });
    kiSvar = async () => resultat(svar([]));
    await foresla(f);
    expect(kall[0]!.kontekst).toContain("Ingen sopp");
    expect(kall[0]!.kontekst).not.toContain("turdager");
  });
});
