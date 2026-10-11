import { describe, expect, it } from "vitest";
import {
  dagerMellom,
  iDag,
  leggTilDager,
  leggTilManeder,
  leggTilMinutterTid,
  mandagFor,
  datoMedAar,
  kortDato,
  langDato,
  maanedOgAar,
  rutenett,
  stor,
  ukedagNr,
  ukenr,
} from "./dato";

describe("dato", () => {
  it("regner med dager over måneds-, års- og sommertidsskifte", () => {
    expect(leggTilDager("2026-10-31", 1)).toBe("2026-11-01");
    expect(leggTilDager("2026-12-31", 1)).toBe("2027-01-01");
    expect(leggTilDager("2026-03-01", -1)).toBe("2026-02-28");
    expect(dagerMellom("2026-10-24", "2026-10-26")).toBe(2);
    expect(dagerMellom("2026-03-28", "2026-03-30")).toBe(2);
  });

  it("uka starter på mandag", () => {
    expect(ukedagNr("2026-10-12")).toBe(0); // mandag
    expect(ukedagNr("2026-10-18")).toBe(6); // søndag
    expect(mandagFor("2026-10-18")).toBe("2026-10-12");
    expect(mandagFor("2026-10-12")).toBe("2026-10-12");
    expect(mandagFor("2026-01-01")).toBe("2025-12-29");
  });

  it("uketall følger ISO-reglene", () => {
    expect(ukenr("2026-10-12")).toBe(42);
    expect(ukenr("2026-10-18")).toBe(42);
    expect(ukenr("2026-10-19")).toBe(43);
    expect(ukenr("2026-01-01")).toBe(1);
    expect(ukenr("2025-12-29")).toBe(1);
    expect(ukenr("2021-01-01")).toBe(53);
    expect(ukenr("2024-12-30")).toBe(1);
    expect(ukenr("2026-12-31")).toBe(53);
  });

  it("flytter måneder uten å hoppe over korte måneder", () => {
    expect(leggTilManeder("2026-01-31", 1)).toBe("2026-02-01");
    expect(leggTilManeder("2026-12-15", 1)).toBe("2027-01-01");
    expect(leggTilManeder("2026-01-15", -1)).toBe("2025-12-01");
  });

  it("månedsrutenettet er hele uker fra mandag til søndag", () => {
    const okt = rutenett("2026-10-15");
    expect(okt[0]).toBe("2026-09-28");
    expect(okt.at(-1)).toBe("2026-11-01");
    expect(okt).toHaveLength(35);
    expect(okt.every((_, i) => ukedagNr(okt[i]!) === i % 7)).toBe(true);
    const feb = rutenett("2027-02-01"); // 1. februar 2027 er en mandag, og måneden har 28 dager
    expect(feb).toHaveLength(28);
    expect(rutenett("2026-08-10")).toHaveLength(42);
  });

  it("dagens dato er norsk dato, ikke UTC", () => {
    expect(iDag(new Date("2026-10-06T22:30:00Z"))).toBe("2026-10-07");
    expect(iDag(new Date("2026-10-06T21:30:00Z"))).toBe("2026-10-06");
    expect(iDag(new Date("2026-12-31T23:30:00Z"))).toBe("2027-01-01");
  });

  it("navn på dager og måneder skrives på norsk, med stor forbokstav bare først", () => {
    expect(langDato("2026-10-06")).toBe("Tirsdag 6. oktober");
    expect(maanedOgAar("2026-10-06")).toBe("Oktober 2026");
    expect(stor("søn")).toBe("Søn");
    expect(kortDato("2026-10-06")).toBe("6. okt.");
    expect(datoMedAar("2026-10-06")).toBe("6. oktober 2026");
  });

  it("klokkeslett går ikke forbi midnatt", () => {
    expect(leggTilMinutterTid("17:00", 60)).toBe("18:00");
    expect(leggTilMinutterTid("23:30", 60)).toBe("23:59");
    expect(leggTilMinutterTid("09:45", 30)).toBe("10:15");
  });
});
