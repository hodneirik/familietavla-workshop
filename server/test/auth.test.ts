import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { lookupSession } from "../src/core/auth.js";
import { loadConfig } from "../src/config.js";
import { createLogger } from "../src/core/logger.js";
import { openDb, type Db } from "../src/db/client.js";
import { migrate } from "../src/db/migrate.js";
import { hashPin } from "../src/core/pin.js";
import { createUser } from "../src/modules/users/service.js";

let db: Db;
let app: ReturnType<typeof createApp>;
let forelder: number;
let barn: number;

beforeEach(() => {
  db = openDb(":memory:");
  migrate(db);
  app = createApp({
    config: loadConfig({ SESSION_SECRET: "x".repeat(32), WEB_DIR: "/finnes-ikke" }),
    db,
    log: createLogger("error"),
  });
  forelder = createUser(db, { visningsnavn: "Anita", rolle: "forelder", pin: "9876" }, null).id;
  barn = createUser(db, { visningsnavn: "Elias", rolle: "barn", pin: "1234" }, null).id;
});

async function loggInn(userId: number, pin: string) {
  const agent = request.agent(app);
  const res = await agent.post("/api/auth/login").send({ userId, pin });
  return { agent, res };
}

describe("innlogging", () => {
  it("riktig PIN gir økt, og /me viser brukeren", async () => {
    const { agent, res } = await loggInn(barn, "1234");
    expect(res.status).toBe(200);
    expect(res.headers["set-cookie"]?.[0]).toMatch(/HttpOnly/i);
    const me = await agent.get("/api/auth/me");
    expect(me.body.bruker.visningsnavn).toBe("Elias");
  });

  it("feil PIN gir 401 og ingen cookie", async () => {
    const { res } = await loggInn(barn, "9999");
    expect(res.status).toBe(401);
    expect(res.headers["set-cookie"]).toBeUndefined();
  });

  it("utestenger etter 5 feil, selv med riktig PIN, og logger det", async () => {
    for (let i = 0; i < 5; i++) expect((await loggInn(barn, "0000")).res.status).toBe(401);
    const { res } = await loggInn(barn, "1234");
    expect(res.status).toBe(429);
    expect(res.body.feil).toMatch(/minutt/);
    const rader = db
      .prepare("SELECT COUNT(*) AS n FROM audit_log WHERE handling = 'innlogging_feilet'")
      .get() as { n: number };
    expect(rader.n).toBe(5);
  });

  it("utestenging av ett barn rammer ikke de andre", async () => {
    for (let i = 0; i < 5; i++) await loggInn(barn, "0000");
    expect((await loggInn(forelder, "9876")).res.status).toBe(200);
  });

  it("utløpt økt gir ikke tilgang", async () => {
    const { agent } = await loggInn(barn, "1234");
    db.prepare("UPDATE sessions SET utloper = '2000-01-01T00:00:00.000Z'").run();
    expect((await agent.get("/api/auth/me")).status).toBe(401);
  });

  it("økten fornyes ved bruk etter en time", async () => {
    await loggInn(barn, "1234");
    const gammel = new Date(Date.now() - 2 * 3_600_000).toISOString();
    db.prepare("UPDATE sessions SET sist_brukt = ?").run(gammel);
    const id = (db.prepare("SELECT id FROM sessions").get() as { id: string }).id;
    expect(lookupSession(db, id)).not.toBeNull();
    const rad = db.prepare("SELECT sist_brukt FROM sessions").get() as { sist_brukt: string };
    expect(rad.sist_brukt > gammel).toBe(true);
  });

  it("utlogging avslutter økten", async () => {
    const { agent } = await loggInn(barn, "1234");
    await agent.post("/api/auth/logout");
    expect((await agent.get("/api/auth/me")).status).toBe(401);
  });

  it("forfalsket cookie godtas ikke", async () => {
    const res = await request(app).get("/api/auth/me").set("Cookie", "sid=s%3Aforfalsket.signatur");
    expect(res.status).toBe(401);
  });

  it("startskjermen viser aktive brukere uten PIN-data", async () => {
    const res = await request(app).get("/api/auth/users");
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(JSON.stringify(res.body)).not.toMatch(/pin/i);
  });
});

describe("roller", () => {
  it("API-et er stengt uten innlogging", async () => {
    for (const [metode, sti] of [
      ["get", "/api/users"],
      ["post", "/api/users"],
      ["patch", `/api/users/${barn}`],
      ["post", `/api/users/${barn}/reset-pin`],
      ["get", "/api/auth/me"],
      ["post", "/api/auth/pin"],
    ] as const) {
      const res = await request(app)[metode](sti).send({});
      expect(res.status, `${metode} ${sti}`).toBe(401);
    }
  });

  it("barn kan ikke gjøre foreldrehandlinger", async () => {
    const { agent } = await loggInn(barn, "1234");
    expect((await agent.get("/api/users")).status).toBe(403);
    expect(
      (await agent.post("/api/users").send({ visningsnavn: "X", rolle: "forelder", pin: "1234" }))
        .status,
    ).toBe(403);
    expect((await agent.patch(`/api/users/${barn}`).send({ rolle: "forelder" })).status).toBe(403);
    expect(
      (await agent.post(`/api/users/${forelder}/reset-pin`).send({ pin: "1111" })).status,
    ).toBe(403);
  });

  it("nye PIN-koder må være 4 sifre, også for voksne", async () => {
    const { agent } = await loggInn(forelder, "9876");
    for (const pin of ["12345", "123456", "123", "12a4"]) {
      const res = await agent
        .post("/api/users")
        .send({ visningsnavn: "Ny", rolle: "forelder", pin });
      expect(res.status, pin).toBe(400);
      expect(res.body.feil).toBe("PIN må være 4 sifre");
    }
    expect(
      (await agent.post(`/api/users/${forelder}/reset-pin`).send({ pin: "123456" })).status,
    ).toBe(400);
    expect((await agent.post("/api/auth/pin").send({ gammel: "9876", ny: "123456" })).status).toBe(
      400,
    );
  });

  it("en voksen med eldre PIN på 6 sifre kan fortsatt logge inn", async () => {
    db.prepare("UPDATE users SET pin_hash = ? WHERE id = ?").run(hashPin("123456"), forelder);
    expect((await loggInn(forelder, "123456")).res.status).toBe(200);
  });

  it("forelder kan opprette bruker, og barn må ha 4-sifret PIN", async () => {
    const { agent } = await loggInn(forelder, "9876");
    const ok = await agent
      .post("/api/users")
      .send({ visningsnavn: "Nelly", rolle: "barn", pin: "4321", emoji: "🦄" });
    expect(ok.status).toBe(201);
    const dårlig = await agent
      .post("/api/users")
      .send({ visningsnavn: "Ola", rolle: "barn", pin: "123456" });
    expect(dårlig.status).toBe(400);
  });

  it("forelder nullstiller PIN, barnets gamle økter avsluttes og utestengingen oppheves", async () => {
    const barnet = await loggInn(barn, "1234");
    for (let i = 0; i < 5; i++) await loggInn(barn, "0000");
    const { agent } = await loggInn(forelder, "9876");
    expect((await agent.post(`/api/users/${barn}/reset-pin`).send({ pin: "5555" })).status).toBe(
      200,
    );
    expect((await barnet.agent.get("/api/auth/me")).status).toBe(401);
    expect((await loggInn(barn, "5555")).res.status).toBe(200);
  });

  it("siste aktive forelder kan ikke deaktiveres eller bli barn", async () => {
    const { agent } = await loggInn(forelder, "9876");
    expect((await agent.patch(`/api/users/${forelder}`).send({ aktiv: false })).status).toBe(409);
    expect((await agent.patch(`/api/users/${forelder}`).send({ rolle: "barn" })).status).toBe(409);
  });

  it("deaktivert bruker mister tilgangen med en gang", async () => {
    const barnet = await loggInn(barn, "1234");
    const { agent } = await loggInn(forelder, "9876");
    await agent.patch(`/api/users/${barn}`).send({ aktiv: false });
    expect((await barnet.agent.get("/api/auth/me")).status).toBe(401);
    expect((await loggInn(barn, "1234")).res.status).toBe(401);
  });

  it("barn kan bytte egen PIN, men må kunne den gamle", async () => {
    const { agent } = await loggInn(barn, "1234");
    expect((await agent.post("/api/auth/pin").send({ gammel: "0000", ny: "7777" })).status).toBe(
      401,
    );
    expect((await agent.post("/api/auth/pin").send({ gammel: "1234", ny: "7777" })).status).toBe(
      200,
    );
    expect((await loggInn(barn, "7777")).res.status).toBe(200);
  });

  it("PIN lagres aldri i klartekst", () => {
    const rad = db.prepare("SELECT pin_hash FROM users WHERE id = ?").get(barn) as {
      pin_hash: string;
    };
    expect(rad.pin_hash).toMatch(/^scrypt\$/);
    expect(rad.pin_hash).not.toContain("1234");
  });
});
