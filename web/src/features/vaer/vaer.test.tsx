import { describe, expect, it } from "vitest";
import { symbol } from "./Vaer";

describe("symbol", () => {
  it.each([
    ["clearsky_day", "sol", "Klarvær", "sol"],
    ["fair_night", "sol_sky", "Lettskyet", null],
    ["partlycloudy_day", "sol_sky", "Delvis skyet", null],
    ["cloudy", "sky", "Skyet", "sky"],
    ["lightrainshowers_day", "sol_regn", "Lett regn", "regn"],
    ["rainshowers_day", "sol_regn", "Regnbyger", "regn"],
    ["heavyrain", "regn", "Kraftig regn", "regn"],
    ["lightsleet", "snøbyger", "Sludd", "regn"],
    ["snow", "snø", "Snø", "snoe"],
    ["rainandthunder", "torden", "Torden", "regn"],
    ["thunder", "torden", "Torden", "torden"],
    ["fog", "tåke", "Tåke", "sky"],
  ])("%s gir ikonet %s", (kode, ikon, tekst, tone) => {
    expect(symbol(kode)).toEqual({ ikon, tekst, tone });
  });

  it("alt med regn er blått, og bare ren overskyet er grå", () => {
    for (const kode of ["lightrain", "rain", "heavyrain", "rainshowers_day", "lightsleet"]) {
      expect(symbol(kode).tone, kode).toBe("regn");
    }
    expect(symbol("cloudy").tone).toBe("sky");
    expect(symbol("partlycloudy_night").tone).toBeNull();
  });

  it("torden uten regn er gul, snø er kjølig, og tåke er grå", () => {
    expect(symbol("thunder").tone).toBe("torden");
    expect(symbol("lightsnow").tone).toBe("snoe");
    expect(symbol("fog").tone).toBe("sky");
  });

  it("faller tilbake til termometer for ukjente og manglende koder", () => {
    expect(symbol("noeNytt")).toEqual({ ikon: "temperatur", tekst: "Ukjent vær", tone: null });
    expect(symbol(null).ikon).toBe("temperatur");
  });
});
