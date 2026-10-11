import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ANIMERTE, AnimertIkon, harAnimasjon } from "./AnimertIkon";
import { IKONER } from "./ikoner";

describe("AnimertIkon", () => {
  it("viser en animert utgave når den finnes, skjult for skjermlesere", () => {
    const html = renderToStaticMarkup(<AnimertIkon navn="hjem" storrelse="l" />);
    expect(html).toContain("animert-ikon");
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain('width="24"');
    expect(html).toContain('stroke-width="1.75"');
  });

  it("faller tilbake til vanlig ikon uten animasjon", () => {
    const html = renderToStaticMarkup(<AnimertIkon navn="slett" />);
    expect(html).not.toContain("animert-ikon");
    expect(html).toContain("<svg");
  });

  it("alle animerte ikoner har et navn i ikonlista", () => {
    for (const navn of Object.keys(ANIMERTE)) {
      expect(navn in IKONER, navn).toBe(true);
      expect(harAnimasjon(navn as keyof typeof IKONER)).toBe(true);
    }
  });

  it("alle fanene i menyen er animert", () => {
    for (const navn of [
      "hjem",
      "gjoremal",
      "lekser",
      "kalender",
      "handle",
      "middag",
      "familie",
      "meg",
    ] as const) {
      expect(harAnimasjon(navn), navn).toBe(true);
    }
  });

  it("solen i den delvis skyede dagen får sin egen farge", () => {
    expect(renderToStaticMarkup(<AnimertIkon navn="sol_sky" />)).toContain("var(--sol)");
  });

  it("skyer i værikonene er alltid grå, også når resten har egen farge", () => {
    for (const navn of [
      "sol_sky",
      "regn",
      "snøbyger",
      "torden",
      "sol_regn",
      "tåke",
      "hagl",
    ] as const) {
      expect(renderToStaticMarkup(<AnimertIkon navn={navn} />), navn).toContain("var(--sky-ikon)");
    }
  });

  it("solen er gul i alle ikoner som har en sol", () => {
    for (const navn of ["sol_sky", "sol_regn"] as const) {
      expect(renderToStaticMarkup(<AnimertIkon navn={navn} />), navn).toContain("var(--sol)");
    }
  });

  it("regnet i sol og regn følger ikonets farge, så det kan være blått", () => {
    const html = renderToStaticMarkup(<AnimertIkon navn="sol_regn" />);
    expect(html).toContain('stroke="currentColor"');
    expect(html).toContain('d="M11 20v2"');
  });
});
