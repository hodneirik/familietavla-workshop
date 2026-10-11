import { describe, expect, it } from "vitest";
import { lesbarTekstfarge } from "./farge";

describe("lesbarTekstfarge", () => {
  it("velger hvit tekst på mørke farger og mørk tekst på lyse", () => {
    expect(lesbarTekstfarge("#000000")).toBe("#ffffff");
    expect(lesbarTekstfarge("#1b3a8a")).toBe("#ffffff");
    expect(lesbarTekstfarge("#ffffff")).toBe("#1b1f27");
    expect(lesbarTekstfarge("#f2b134")).toBe("#1b1f27");
  });

  it("gir god kontrast for fargene familien bruker", () => {
    // Fargene fra startskjermen: blå, grønn og rosa
    for (const farge of ["#4f8cff", "#2fb67c", "#e8579a", "#ff7a59", "#a56bff"]) {
      const tekst = lesbarTekstfarge(farge);
      expect(["#ffffff", "#1b1f27"]).toContain(tekst);
    }
    expect(lesbarTekstfarge("#2fb67c")).toBe("#1b1f27");
    expect(lesbarTekstfarge("#e8579a")).toBe("#1b1f27");
  });

  it("tåler store og små bokstaver, og ugyldige verdier gir mørk tekst", () => {
    expect(lesbarTekstfarge("#F2B134")).toBe("#1b1f27");
    expect(lesbarTekstfarge("rød")).toBe("#1b1f27");
    expect(lesbarTekstfarge("")).toBe("#1b1f27");
    expect(lesbarTekstfarge("#fff")).toBe("#1b1f27");
  });
});
