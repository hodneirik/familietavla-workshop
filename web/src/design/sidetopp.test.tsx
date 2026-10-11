import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Navlinje, Sidetopp } from "./Sidetopp";

describe("Sidetopp og Navlinje", () => {
  it("har tittel til venstre og knappene i en egen gruppe til høyre", () => {
    const html = renderToStaticMarkup(
      <Sidetopp tittel="Skole">
        <button type="button">Ny lekse</button>
      </Sidetopp>,
    );
    expect(html).toContain("<h2>Skole</h2>");
    expect(html).toContain('class="sidetopp__handlinger"');
    expect(renderToStaticMarkup(<Sidetopp tittel="Handleliste" />)).not.toContain("handlinger");
  });

  it("navlinjen har teksten og forrige, i dag og neste med navn for skjermlesere", () => {
    const html = renderToStaticMarkup(
      <Navlinje
        tekst="Uke 41 · oktober 2026"
        forrige={() => {}}
        neste={() => {}}
        iDag={() => {}}
        enhet="uke"
      />,
    );
    expect(html).toContain("Uke 41 · oktober 2026");
    expect(html).toContain("Forrige uke");
    expect(html).toContain("Neste uke");
    expect(html).toContain("I dag");
  });
});
