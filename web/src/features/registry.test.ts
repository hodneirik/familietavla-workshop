import { describe, expect, it } from "vitest";
import { faner } from "./registry";

const forRolle = (rolle: "forelder" | "barn" | "besteforelder") =>
  faner.filter((f) => f.paa && f.roller.includes(rolle)).map((f) => f.id);

describe("faner per rolle", () => {
  it("besteforeldre får bare det de har bruk for", () => {
    expect(forRolle("besteforelder")).toEqual(["hjem", "gjoremal", "meg"]);
  });

  it("foreldre og barn har fortsatt sine faner", () => {
    expect(forRolle("forelder")).toEqual([
      "hjem",
      "gjoremal",
      "skole",
      "kalender",
      "handleliste",
      "middag",
      "meg",
    ]);
    expect(forRolle("barn")).toEqual(["hjem", "gjoremal", "skole", "handleliste", "middag", "meg"]);
  });

  it("fanen for profil og familie heter Innstillinger", () => {
    const f = faner.find((x) => x.id === "meg");
    expect(f?.navn).toBe("Innstillinger");
    expect(f?.ikon).toBe("innstillinger");
  });
});
