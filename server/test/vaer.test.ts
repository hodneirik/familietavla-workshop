import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app.js";
import { loadConfig } from "../src/config.js";
import { createLogger } from "../src/core/logger.js";
import { openDb } from "../src/db/client.js";
import { migrate } from "../src/db/migrate.js";
import { createUser } from "../src/modules/users/service.js";
import { lagDager } from "../src/modules/vaer/service.js";

/** Lik formen kilden gir: time for time i to døgn, så hver sjette time. Starter 6. okt 14:00 UTC (16:00 norsk tid). */
function lagRader() {
  const rader: Record<string, unknown>[] = [];
  const start = Date.parse("2026-10-06T14:00:00Z");
  for (let t = 0; t < 48; t++) {
    rader.push({
      time: new Date(start + t * 3_600_000).toISOString(),
      interval_hours: 1,
      temperature_c: 10 + (t % 12),
      wind_speed_ms: 3 + (t % 5),
      precipitation_mm: t === 5 ? 1.5 : 0,
      symbol: t % 24 < 12 ? "rainshowers_day" : "clearsky_night",
    });
  }
  for (let t = 0; t < 28; t++) {
    rader.push({
      time: new Date(start + 48 * 3_600_000 + t * 6 * 3_600_000).toISOString(),
      interval_hours: 6,
      temperature_c: 8,
      wind_speed_ms: 4,
      precipitation_mm: 0.5,
      symbol: "cloudy",
    });
  }
  return rader;
}

const svar = (data: unknown, status = 200) =>
  new Response(JSON.stringify({ data }), {
    status,
    headers: { "content-type": "application/json" },
  });

let nå = Date.parse("2026-10-06T14:30:00Z");
let fetchFn: ReturnType<typeof vi.fn>;

function lagApp(env: Record<string, string> = {}) {
  const db = openDb(":memory:");
  migrate(db);
  const app = createApp({
    config: loadConfig({ SESSION_SECRET: "x".repeat(32), WEB_DIR: "/finnes-ikke", ...env }),
    db,
    log: createLogger("error"),
    fetch: fetchFn as unknown as typeof fetch,
    naa: () => nå,
  });
  const id = createUser(db, { visningsnavn: "Elias", rolle: "barn", pin: "1234" }, null).id;
  return { app, id };
}

async function innlogget(app: ReturnType<typeof createApp>, id: number) {
  const agent = request.agent(app);
  expect((await agent.post("/api/auth/login").send({ userId: id, pin: "1234" })).status).toBe(200);
  return agent;
}

beforeEach(() => {
  nå = Date.parse("2026-10-06T14:30:00Z");
  fetchFn = vi.fn(async () => svar(lagRader()));
});

describe("lagDager", () => {
  it("lager én rad per dag i norsk tid, maks sju", () => {
    const dager = lagDager(lagRader() as never);
    expect(dager).toHaveLength(7);
    expect(dager[0]!.dato).toBe("2026-10-06");
    expect(dager.map((d) => d.dato)).toEqual([
      "2026-10-06",
      "2026-10-07",
      "2026-10-08",
      "2026-10-09",
      "2026-10-10",
      "2026-10-11",
      "2026-10-12",
    ]);
  });

  it("deler døgnet ved midnatt norsk tid, ikke UTC", () => {
    const dager = lagDager([
      { time: "2026-10-06T21:00:00Z", temperature_c: 5, precipitation_mm: 1, symbol: "cloudy" },
      { time: "2026-10-06T22:00:00Z", temperature_c: 9, precipitation_mm: 2, symbol: "rain" },
    ]);
    expect(dager.map((d) => [d.dato, d.nedbor])).toEqual([
      ["2026-10-06", 1],
      ["2026-10-07", 2],
    ]);
  });

  it("regner min, maks, nedbør og vind, og velger symbolet nærmest midt på dagen", () => {
    const dager = lagDager([
      {
        time: "2026-10-07T04:00:00Z",
        temperature_c: 4,
        wind_speed_ms: 2,
        precipitation_mm: 0.4,
        symbol: "fog",
      },
      {
        time: "2026-10-07T11:00:00Z",
        temperature_c: 12.34,
        wind_speed_ms: 7.5,
        precipitation_mm: 1.2,
        symbol: "lightrain_day",
      },
      {
        time: "2026-10-07T19:00:00Z",
        temperature_c: 8,
        wind_speed_ms: 3,
        precipitation_mm: null,
        symbol: "clearsky_night",
      },
    ]);
    expect(dager).toEqual([
      {
        dato: "2026-10-07",
        tempMin: 4,
        tempMaks: 12.3,
        nedbor: 1.6,
        vindMaks: 7.5,
        symbol: "lightrain",
      },
    ]);
  });

  it("viser det kraftigste nedbørssymbolet på en dag med merkbar nedbør, ellers midt på dagen", () => {
    const regnfull = lagDager([
      { time: "2026-10-07T07:00:00Z", temperature_c: 11, precipitation_mm: 0, symbol: "cloudy" },
      {
        time: "2026-10-07T14:00:00Z",
        temperature_c: 9,
        precipitation_mm: 1.7,
        symbol: "lightrain",
      },
      {
        time: "2026-10-07T17:00:00Z",
        temperature_c: 8,
        precipitation_mm: 4.4,
        symbol: "heavyrain_night",
      },
    ]);
    expect(regnfull[0]!.symbol).toBe("heavyrain");

    const duskregn = lagDager([
      { time: "2026-10-07T11:00:00Z", temperature_c: 11, precipitation_mm: 0.6, symbol: "cloudy" },
      {
        time: "2026-10-07T15:00:00Z",
        temperature_c: 9,
        precipitation_mm: 0.3,
        symbol: "lightrain",
      },
    ]);
    expect(duskregn[0]!.symbol).toBe("cloudy");

    const torden = lagDager([
      { time: "2026-10-07T10:00:00Z", temperature_c: 20, precipitation_mm: 2, symbol: "rain" },
      {
        time: "2026-10-07T15:00:00Z",
        temperature_c: 18,
        precipitation_mm: 3,
        symbol: "rainandthunder",
      },
    ]);
    expect(torden[0]!.symbol).toBe("rainandthunder");
  });

  it("tåler manglende verdier og ugyldig tid", () => {
    const dager = lagDager([
      { time: "ikke en tid", temperature_c: 5 },
      { time: "2026-10-07T10:00:00Z", temperature_c: null, symbol: null },
    ]);
    expect(dager).toEqual([
      {
        dato: "2026-10-07",
        tempMin: null,
        tempMaks: null,
        nedbor: 0,
        vindMaks: null,
        symbol: null,
      },
    ]);
  });
});

describe("/api/vaer", () => {
  it("krever innlogging", async () => {
    const { app } = lagApp();
    expect((await request(app).get("/api/vaer")).status).toBe(401);
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("gir sju dager for stedet, og spør kilden med riktig koordinat", async () => {
    const { app, id } = lagApp();
    const agent = await innlogget(app, id);
    const res = await agent.get("/api/vaer");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ sted: "Oslo", foreldet: false });
    expect(res.body.dager).toHaveLength(7);
    expect(res.body.hentet).toBe("2026-10-06T14:30:00.000Z");

    const url = fetchFn.mock.calls[0]![0] as URL;
    expect(url.origin + url.pathname).toBe(
      "https://allemannsdata.com/wiki/api/v1/kilder/weather/get_forecast",
    );
    expect(url.searchParams.get("lat")).toBe("59.9139");
    expect(url.searchParams.get("lon")).toBe("10.7522");
  });

  it("bruker sted og koordinater fra oppsettet", async () => {
    const { app, id } = lagApp({ VAER_STED: "Bergen", VAER_LAT: "60.39", VAER_LON: "5.32" });
    const agent = await innlogget(app, id);
    expect((await agent.get("/api/vaer")).body.sted).toBe("Bergen");
    const url = fetchFn.mock.calls[0]![0] as URL;
    expect([url.searchParams.get("lat"), url.searchParams.get("lon")]).toEqual(["60.39", "5.32"]);
  });

  it("mellomlagrer: mange forespørsler gir én henting, og ny henting etter en halvtime", async () => {
    const { app, id } = lagApp();
    const agent = await innlogget(app, id);
    await Promise.all([agent.get("/api/vaer"), agent.get("/api/vaer"), agent.get("/api/vaer")]);
    await agent.get("/api/vaer");
    expect(fetchFn).toHaveBeenCalledTimes(1);
    nå += 29 * 60_000;
    await agent.get("/api/vaer");
    expect(fetchFn).toHaveBeenCalledTimes(1);
    nå += 2 * 60_000;
    const res = await agent.get("/api/vaer");
    expect(fetchFn).toHaveBeenCalledTimes(2);
    expect(res.body.hentet).toBe(new Date(nå).toISOString());
  });

  it("gir 503 når kilden er nede og det ikke finnes noe lagret", async () => {
    fetchFn.mockRejectedValue(new Error("nettverk nede"));
    const { app, id } = lagApp();
    const agent = await innlogget(app, id);
    const res = await agent.get("/api/vaer");
    expect(res.status).toBe(503);
    expect(res.body.feil).toMatch(/ikke tilgjengelig/);
  });

  it("gir 503 for feilstatus og for svar i feil format", async () => {
    const { app, id } = lagApp();
    const agent = await innlogget(app, id);
    fetchFn.mockResolvedValueOnce(svar([], 500));
    expect((await agent.get("/api/vaer")).status).toBe(503);
    nå += 61_000;
    fetchFn.mockResolvedValueOnce(new Response(JSON.stringify({ noeAnnet: 1 })));
    expect((await agent.get("/api/vaer")).status).toBe(503);
    nå += 61_000;
    fetchFn.mockResolvedValueOnce(svar([]));
    expect((await agent.get("/api/vaer")).status).toBe(503);
  });

  it("viser et eldre varsel merket som foreldet når kilden går ned, men ikke for gammelt", async () => {
    const { app, id } = lagApp();
    const agent = await innlogget(app, id);
    expect((await agent.get("/api/vaer")).body.foreldet).toBe(false);
    fetchFn.mockRejectedValue(new Error("nede"));
    nå += 40 * 60_000;
    const gammelt = await agent.get("/api/vaer");
    expect(gammelt.status).toBe(200);
    expect(gammelt.body.foreldet).toBe(true);
    expect(gammelt.body.hentet).toBe("2026-10-06T14:30:00.000Z");
    nå += 12 * 3_600_000;
    expect((await agent.get("/api/vaer")).status).toBe(503);
  });

  it("hamrer ikke kilden når den er nede: nytt forsøk først etter ett minutt", async () => {
    fetchFn.mockRejectedValue(new Error("nede"));
    const { app, id } = lagApp();
    const agent = await innlogget(app, id);
    for (let i = 0; i < 5; i++) await agent.get("/api/vaer");
    expect(fetchFn).toHaveBeenCalledTimes(1);
    nå += 61_000;
    await agent.get("/api/vaer");
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it("kan skrus av med VAER_AKTIV=false", async () => {
    const { app, id } = lagApp({ VAER_AKTIV: "false" });
    const agent = await innlogget(app, id);
    expect((await agent.get("/api/vaer")).status).toBe(404);
    expect(fetchFn).not.toHaveBeenCalled();
  });
});
