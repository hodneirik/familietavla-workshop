import { describe, expect, it } from "vitest";
import type { Hendelse } from "../../lib/types";
import { dagerTilSondag, paaDag, tidTekst } from "./tid";

const h = (id: number, start: string, slutt: string, helDag = false): Hendelse => ({
  id,
  kalenderId: 1,
  tittel: `Avtale ${id}`,
  start,
  slutt,
  helDag,
  sted: null,
  kilde: "manuell",
  gjentas: null,
  gjentasTil: null,
  startOriginal: start,
  sluttOriginal: slutt,
});

describe("paaDag", () => {
  it("treffer avtaler som overlapper dagen, også flerdagers", () => {
    const ferie = h(1, "2026-10-12T00:00", "2026-10-17T00:00", true);
    expect(paaDag(ferie, "2026-10-12")).toBe(true);
    expect(paaDag(ferie, "2026-10-16")).toBe(true);
    expect(paaDag(ferie, "2026-10-17")).toBe(false);
    expect(paaDag(ferie, "2026-10-11")).toBe(false);
  });

  it("en avtale som slutter ved midnatt hører ikke til dagen etter", () => {
    expect(paaDag(h(1, "2026-10-12T00:00", "2026-10-13T00:00", true), "2026-10-13")).toBe(false);
    expect(paaDag(h(2, "2026-10-12T23:00", "2026-10-13T01:00"), "2026-10-13")).toBe(true);
  });
});

describe("tidTekst", () => {
  it("skriver tid på norsk", () => {
    expect(tidTekst(h(1, "2026-10-12T17:00", "2026-10-12T18:30"))).toBe("17:00 til 18:30");
    expect(tidTekst(h(2, "2026-10-12T00:00", "2026-10-13T00:00", true))).toBe("Hele dagen");
    expect(tidTekst(h(3, "2026-10-12T00:00", "2026-10-17T00:00", true))).toBe(
      "12. okt. til 16. okt.",
    );
    expect(tidTekst(h(4, "2026-10-12T22:00", "2026-10-13T01:00"))).toBe("22:00 til 13. okt. 01:00");
  });
});

describe("dagerTilSondag", () => {
  it("tar med alle dagene fra mandag til søndag på en mandag", () => {
    expect(dagerTilSondag("2026-10-05")).toEqual([
      "2026-10-05",
      "2026-10-06",
      "2026-10-07",
      "2026-10-08",
      "2026-10-09",
      "2026-10-10",
      "2026-10-11",
    ]);
  });

  it("slutter på nærmeste søndag midt i uka", () => {
    expect(dagerTilSondag("2026-10-08")).toEqual([
      "2026-10-08",
      "2026-10-09",
      "2026-10-10",
      "2026-10-11",
    ]);
    expect(dagerTilSondag("2026-10-10")).toEqual(["2026-10-10", "2026-10-11"]);
  });

  it("viser bare søndagen på en søndag, og begynner på ny uke dagen etter", () => {
    expect(dagerTilSondag("2026-10-11")).toEqual(["2026-10-11"]);
    expect(dagerTilSondag("2026-10-12")).toHaveLength(7);
  });

  it("virker over månedsskifte og årsskifte", () => {
    expect(dagerTilSondag("2026-12-30")).toEqual([
      "2026-12-30",
      "2026-12-31",
      "2027-01-01",
      "2027-01-02",
      "2027-01-03",
    ]);
  });
});

describe("ukentlig avtale", () => {
  it("vises som en vanlig avtale på dagen forekomsten ligger", () => {
    const uke = {
      ...h(1, "2026-10-13T17:00", "2026-10-13T18:00"),
      gjentas: "ukentlig" as const,
      gjentasTil: "2026-12-01",
      startOriginal: "2026-09-29T17:00",
      sluttOriginal: "2026-09-29T18:00",
    };
    expect(paaDag(uke, "2026-10-13")).toBe(true);
    expect(paaDag(uke, "2026-10-14")).toBe(false);
    expect(tidTekst(uke)).toBe("17:00 til 18:00");
  });
});
