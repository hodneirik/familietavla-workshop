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

beforeEach(() => {
  db = openDb(":memory:");
  migrate(db);
  app = createApp({
    config: loadConfig({ SESSION_SECRET: "x".repeat(32), WEB_DIR: "/finnes-ikke" }),
    db,
    log: createLogger("error"),
  });
  forelder = createUser(
    db,
    { visningsnavn: "Anita", rolle: "forelder", emoji: "🧔", pin: "9876" },
    null,
  ).id;
  haakon = createUser(
    db,
    { visningsnavn: "Elias", rolle: "barn", emoji: "🦖", pin: "1234" },
    null,
  ).id;
});

async function agentFor(userId: number, pin: string) {
  const agent = request.agent(app);
  expect((await agent.post("/api/auth/login").send({ userId, pin })).status).toBe(200);
  return agent;
}

describe("bytte emoji på egen profil", () => {
  it("krever innlogging", async () => {
    expect((await request(app).patch("/api/auth/me").send({ emoji: "🐶" })).status).toBe(401);
  });

  it("et barn kan bytte sin egen emoji, og den vises overalt", async () => {
    const h = await agentFor(haakon, "1234");
    const res = await h.patch("/api/auth/me").send({ emoji: "🦄" });
    expect(res.status).toBe(200);
    expect(res.body.bruker).toEqual({
      id: haakon,
      visningsnavn: "Elias",
      rolle: "barn",
      farge: "#889cb0",
      emoji: "🦄",
    });
    expect((await h.get("/api/auth/me")).body.bruker.emoji).toBe("🦄");
    const fliser = (await request(app).get("/api/auth/users")).body as {
      id: number;
      emoji: string;
    }[];
    expect(fliser.find((f) => f.id === haakon)!.emoji).toBe("🦄");
  });

  it("forelder kan også bytte sin egen emoji, og andres blir stående", async () => {
    const f = await agentFor(forelder, "9876");
    await f.patch("/api/auth/me").send({ emoji: "🚀" });
    const fliser = (await request(app).get("/api/auth/users")).body as {
      id: number;
      emoji: string;
    }[];
    expect(fliser.find((x) => x.id === forelder)!.emoji).toBe("🚀");
    expect(fliser.find((x) => x.id === haakon)!.emoji).toBe("🦖");
  });

  it("tar imot sammensatte emoji: familie, flagg og hudtone", async () => {
    const h = await agentFor(haakon, "1234");
    for (const e of ["👨‍👩‍👧", "🇳🇴", "👍🏽", "❤️", "🏳️‍🌈"]) {
      const res = await h.patch("/api/auth/me").send({ emoji: e });
      expect(res.status, e).toBe(200);
      expect(res.body.bruker.emoji).toBe(e);
    }
  });

  it("avviser alt som ikke er emoji", async () => {
    const h = await agentFor(haakon, "1234");
    for (const e of ["", "   ", "abc", "a😀", "😀 😀", "1", "<script>", "😀".repeat(17)]) {
      expect((await h.patch("/api/auth/me").send({ emoji: e })).status, JSON.stringify(e)).toBe(
        400,
      );
    }
    const melding = await h.patch("/api/auth/me").send({ emoji: "abc" });
    expect(melding.body.feil).toBe("Det må være en emoji, ikke bokstaver eller tall");
    expect((await h.patch("/api/auth/me").send({})).status).toBe(400);
    expect((await h.patch("/api/auth/me").send({ emoji: 5 })).status).toBe(400);
    expect((await h.get("/api/auth/me")).body.bruker.emoji).toBe("🦖");
  });

  it("kan ikke brukes til å endre noe annet, som rolle, farge, navn eller andre brukere", async () => {
    const h = await agentFor(haakon, "1234");
    expect((await h.patch("/api/auth/me").send({ emoji: "🐶", rolle: "forelder" })).status).toBe(
      400,
    );
    expect((await h.patch("/api/auth/me").send({ emoji: "🐶", farge: "#000000" })).status).toBe(
      400,
    );
    expect((await h.patch("/api/auth/me").send({ emoji: "🐶", id: forelder })).status).toBe(400);
    const rad = db.prepare("SELECT rolle, farge, emoji FROM users WHERE id = ?").get(haakon);
    expect(rad).toEqual({ rolle: "barn", farge: "#889cb0", emoji: "🦖" });
    expect(
      (db.prepare("SELECT emoji FROM users WHERE id = ?").get(forelder) as { emoji: string }).emoji,
    ).toBe("🧔");
  });

  it("endringen logges, og økten består", async () => {
    const h = await agentFor(haakon, "1234");
    await h.patch("/api/auth/me").send({ emoji: "🐙" });
    const logg = db.prepare("SELECT user_id FROM audit_log WHERE handling = 'bruker_endret'").all();
    expect(logg).toEqual([{ user_id: haakon }]);
    expect((await h.get("/api/auth/me")).status).toBe(200);
  });
});
