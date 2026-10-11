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

beforeEach(() => {
  db = openDb(":memory:");
  migrate(db);
  app = createApp({
    config: loadConfig({ SESSION_SECRET: "x".repeat(32), WEB_DIR: "/finnes-ikke" }),
    db,
    log: createLogger("error"),
    naa: () => Date.parse("2026-10-07T10:00:00Z"),
  });
  forelder = createUser(db, { visningsnavn: "Anita", rolle: "forelder", pin: "9876" }, null).id;
});

async function somForelder() {
  const agent = request.agent(app);
  await agent.post("/api/auth/login").send({ userId: forelder, pin: "9876" });
  return agent;
}
type Agent = Awaited<ReturnType<typeof somForelder>>;

const rett = async (f: Agent, tittel: string, ingredienser: string[]) =>
  (await f.post("/api/middag/retter").send({ tittel, ingredienser })).body.id as number;
const vare = async (f: Agent, navn: string) =>
  (
    (await f.get("/api/handleliste")).body as {
      navn: string;
      mengde: string | null;
      notat: string | null;
    }[]
  ).find((v) => v.navn === navn);

describe("mengder på handlelisten", () => {
  it("legger sammen mengder når flere middager trenger samme vare, og viser det per middag", async () => {
    const f = await somForelder();
    const taco = await rett(f, "Taco", ["400 g kjøttdeig", "1 stk salat", "1 pk tortilla", "salt"]);
    const wraps = await rett(f, "Wraps", ["1 stk salat", "2 pk tortilla", "200 g kjøttdeig"]);
    await f.put("/api/middag/2026-10-08").send({ rettId: taco });
    await f.put("/api/middag/2026-10-10").send({ rettId: wraps });

    const lista = (await f.get("/api/handleliste")).body as {
      navn: string;
      mengde: string | null;
    }[];
    // Én linje per vare, ikke én per middag
    expect(lista.map((v) => v.navn).sort()).toEqual(["Kjøttdeig", "Salat", "Salt", "Tortilla"]);
    expect(await vare(f, "Salat")).toMatchObject({ mengde: "2 stk" });
    expect(await vare(f, "Tortilla")).toMatchObject({ mengde: "3 pk" });
    expect(await vare(f, "Kjøttdeig")).toMatchObject({ mengde: "600 g" });
    expect(await vare(f, "Salt")).toMatchObject({ mengde: null });
    const notat = (await vare(f, "Salat"))!.notat!;
    expect(notat).toContain("Til Taco (1 stk)");
    expect(notat).toContain("Til Wraps (1 stk)");
  });

  it("regner om på tvers av enheter og tar bort mengden igjen når en middag fjernes", async () => {
    const f = await somForelder();
    const a = await rett(f, "Suppe", ["5 dl fløte", "1 kg poteter"]);
    const b = await rett(f, "Gratinert", ["2 dl fløte", "700 g poteter"]);
    await f.put("/api/middag/2026-10-08").send({ rettId: a });
    await f.put("/api/middag/2026-10-09").send({ rettId: b });
    expect(await vare(f, "Fløte")).toMatchObject({ mengde: "7 dl" });
    expect(await vare(f, "Poteter")).toMatchObject({ mengde: "1,7 kg" });
    await f.delete("/api/middag/2026-10-09");
    expect(await vare(f, "Fløte")).toMatchObject({ mengde: "5 dl" });
    expect(await vare(f, "Poteter")).toMatchObject({ mengde: "1 kg" });
  });

  it("legger sammen samme vare to ganger i én rett, og sier «og mer» når noe mangler mengde", async () => {
    const f = await somForelder();
    const a = await rett(f, "Gryte", ["2 stk løk", "1 stk løk", "salat"]);
    const b = await rett(f, "Wok", ["1 stk salat"]);
    await f.put("/api/middag/2026-10-08").send({ rettId: a });
    await f.put("/api/middag/2026-10-09").send({ rettId: b });
    expect(await vare(f, "Løk")).toMatchObject({ mengde: "3 stk" });
    expect(await vare(f, "Salat")).toMatchObject({ mengde: "1 stk og mer" });
  });

  it("gamle retter uten mengder virker som før", async () => {
    const f = await somForelder();
    const r = await rett(f, "Pasta", ["pasta", "tomatsaus"]);
    await f.put("/api/middag/2026-10-08").send({ rettId: r });
    expect(await vare(f, "Pasta")).toMatchObject({ mengde: null });
    expect(((await f.get("/api/handleliste")).body as unknown[]).length).toBe(2);
  });
});
