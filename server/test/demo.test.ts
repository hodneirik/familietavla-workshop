import { describe, expect, it } from "vitest";
import { seedDemo, DEMO_BRUKERE } from "../src/db/demo.js";
import { openDb } from "../src/db/client.js";
import { migrate } from "../src/db/migrate.js";

function tell(db: ReturnType<typeof openDb>, tabell: string): number {
  return (db.prepare(`SELECT COUNT(*) AS n FROM ${tabell}`).get() as { n: number }).n;
}

describe("demofamilien", () => {
  it("fyller alle fanene med eksempeldata", () => {
    const db = openDb(":memory:");
    migrate(db);
    seedDemo(db);
    expect(tell(db, "users")).toBe(DEMO_BRUKERE.length);
    for (const tabell of [
      "events",
      "retter",
      "middag",
      "handleliste",
      "gjoremal",
      "lekser",
      "lapper",
    ]) {
      expect(tell(db, tabell), tabell).toBeGreaterThan(0);
    }
  });

  it("kan ikke lastes inn over en database som allerede har brukere", () => {
    const db = openDb(":memory:");
    migrate(db);
    seedDemo(db);
    expect(() => seedDemo(db)).toThrow(/allerede brukere/);
  });

  it("virker uansett ukedag", () => {
    for (let dag = 0; dag < 7; dag++) {
      const db = openDb(":memory:");
      migrate(db);
      const naa = Date.parse(`2026-11-${String(2 + dag).padStart(2, "0")}T10:00:00Z`);
      expect(() => seedDemo(db, naa)).not.toThrow();
    }
  });
});
