import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { loadConfig } from "../src/config.js";
import { createLogger } from "../src/core/logger.js";
import { openDb } from "../src/db/client.js";
import { migrate } from "../src/db/migrate.js";

function appMedWeb() {
  const dir = mkdtempSync(path.join(tmpdir(), "web-"));
  mkdirSync(path.join(dir, "assets"));
  writeFileSync(path.join(dir, "index.html"), "<html></html>");
  writeFileSync(path.join(dir, "assets", "index-abc.js"), "console.log(1)");
  const db = openDb(":memory:");
  migrate(db);
  return createApp({
    config: loadConfig({ SESSION_SECRET: "x".repeat(32), WEB_DIR: dir }),
    db,
    log: createLogger("error"),
  });
}

describe("hurtiglagring av appen", () => {
  it("siden må alltid sjekkes på nytt, så en app på hjemskjermen finner nye versjoner", async () => {
    const app = appMedWeb();
    expect((await request(app).get("/")).headers["cache-control"]).toBe("no-cache");
    expect((await request(app).get("/index.html")).headers["cache-control"]).toBe("no-cache");
    expect((await request(app).get("/noe/annet")).headers["cache-control"]).toBe("no-cache");
  });

  it("filene i assets har nytt navn for hver bygging og hurtiglagres lenge", async () => {
    const res = await request(appMedWeb()).get("/assets/index-abc.js");
    expect(res.headers["cache-control"]).toBe("public, max-age=31536000, immutable");
  });
});
