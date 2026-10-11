import { describe, expect, it } from "vitest";
import { gjeldendeVersjon, versjoner, versjonsnummer } from "./nytt";

describe("hva er nytt", () => {
  it("har versjoner, og nyeste kommer først med høyest nummer", () => {
    expect(versjoner.length).toBeGreaterThan(0);
    expect(gjeldendeVersjon).toBe(versjoner[0]);
    const rekkefolge = versjoner.map((v) => v.nummer * 1000 + (v.delnummer ?? 0));
    expect(rekkefolge).toEqual([...rekkefolge].sort((a, b) => b - a));
    expect(new Set(rekkefolge).size).toBe(rekkefolge.length);
    expect(gjeldendeVersjon.nummer * 1000 + (gjeldendeVersjon.delnummer ?? 0)).toBe(
      Math.max(...rekkefolge),
    );
  });

  it("hovednumrene går uten hull fra 1, og hvert hovednavn er unikt", () => {
    const hoved = versjoner.filter((v) => !v.delnummer);
    const nummer = hoved.map((v) => v.nummer).sort((a, b) => a - b);
    expect(nummer).toEqual(Array.from({ length: hoved.length }, (_, i) => i + 1));
    expect(new Set(hoved.map((v) => v.navn)).size).toBe(hoved.length);
  });

  it("delversjoner (27.1, 27.2 ...) hører til en hovedversjon, har samme navn og telles uten hull", () => {
    for (const v of versjoner.filter((v) => v.delnummer)) {
      const hoved = versjoner.find((h) => h.nummer === v.nummer && !h.delnummer);
      expect(hoved, `hovedversjon for ${versjonsnummer(v)}`).toBeDefined();
      expect(v.navn).toBe(hoved!.navn);
      expect(Number.isInteger(v.delnummer) && v.delnummer! >= 1).toBe(true);
    }
    for (const nr of new Set(versjoner.map((v) => v.nummer))) {
      const deler = versjoner
        .filter((v) => v.nummer === nr && v.delnummer)
        .map((v) => v.delnummer!)
        .sort((a, b) => a - b);
      expect(deler).toEqual(Array.from({ length: deler.length }, (_, i) => i + 1));
    }
  });

  it("viser nummeret som 27 for en hovedversjon og 27.1 for en delversjon", () => {
    expect(versjonsnummer({ nummer: 27 })).toBe("27");
    expect(versjonsnummer({ nummer: 27, delnummer: 1 })).toBe("27.1");
    expect(versjonsnummer(gjeldendeVersjon)).toMatch(/^\d+(\.\d+)?$/);
  });

  it("navnene er alfabetiske: dyr til og med versjon 21, så planter fra versjon 22 begynner på A igjen", () => {
    const bokstaver = "ABCDEFGHIJKLMNOPRSTUV";
    const rekker = [
      [...versjoner].reverse().filter((v) => !v.delnummer && v.nummer <= 21),
      [...versjoner].reverse().filter((v) => !v.delnummer && v.nummer > 21),
    ];
    for (const rekke of rekker) {
      const navn = rekke.map((v) => v.navn);
      expect(navn).toEqual([...navn].sort((a, b) => a.localeCompare(b, "nb")));
      expect(navn.every((n, i) => n.charAt(0).toLocaleUpperCase("nb") === bokstaver[i])).toBe(true);
    }
  });

  it("datoene er gyldige og går ikke bakover i tid", () => {
    for (const v of versjoner) {
      expect(v.dato).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(Number.isNaN(Date.parse(v.dato))).toBe(false);
    }
    const datoer = [...versjoner].reverse().map((v) => v.dato);
    expect(datoer).toEqual([...datoer].sort());
  });

  it("hver versjon har tittel og endringer, og noe barna kan lese", () => {
    for (const v of versjoner) {
      expect(v.tittel.trim()).not.toBe("");
      expect(v.endringer.length).toBeGreaterThan(0);
      expect(
        v.endringer.filter((e) => e.for !== "voksne").length,
        `versjon ${versjonsnummer(v)}`,
      ).toBeGreaterThan(0);
      expect(new Set(v.endringer.map((e) => e.tekst)).size).toBe(v.endringer.length);
    }
  });

  it("tekstene unngår tankestrek og skriver KI, ikke AI", () => {
    const alle = versjoner
      .flatMap((v) => [v.tittel, ...v.endringer.map((e) => e.tekst)])
      .join("\n");
    expect(alle).not.toMatch(/[–—]/);
    expect(alle).not.toMatch(/\bAI\b/);
  });
});
