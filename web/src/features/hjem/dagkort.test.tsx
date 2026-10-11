import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { Lekse, Paaminnelse } from "../../lib/types";
import { Dagkort } from "./Dagkort";

const lekse: Lekse = {
  id: 1,
  barn: { id: 2, visningsnavn: "Elias", farge: "#82b797", emoji: "🦖" },
  fag: "Norsk",
  tittel: "Les side 40",
  fritekst: null,
  frist: "2026-10-08",
  gjort: false,
};

const gym: Paaminnelse = {
  id: 1,
  barn: lekse.barn,
  tittel: "Gym",
  ukedag: 3,
  dato: null,
  fra: null,
  til: null,
};

const kort = (lekser: Lekse[], paaminnelser: Paaminnelse[] = []) =>
  renderToStaticMarkup(
    <Dagkort
      dato="2026-10-08"
      erIDag={false}
      hendelser={[]}
      middag={null}
      kalenderMap={new Map()}
      lekser={lekser}
      paaminnelser={paaminnelser}
    />,
  );

describe("Dagkort", () => {
  it("setter leksene under en egen overskrift, adskilt fra avtaler og middag", () => {
    const html = kort([lekse]);
    expect(html).toContain(">Lekser</h4>");
    expect(html.indexOf("Lekser</h4>")).toBeLessThan(html.indexOf("Les side 40"));
    expect(html).toContain("aria-labelledby");
    expect(html).not.toContain("Ingen avtaler");
  });

  it("har ingen lekseoverskrift uten lekser", () => {
    const html = kort([]);
    expect(html).not.toContain("Lekser");
    expect(html).toContain("Ingen avtaler");
  });

  it("viser påminnelser som en liten linje før avtalene, uten egen overskrift", () => {
    const html = kort([], [gym]);
    expect(html).toContain('aria-label="Påminnelser"');
    expect(html).not.toContain("<h4");
    expect(html.indexOf("Gym")).toBeLessThan(html.indexOf("Ingen avtaler"));
  });

  it("har ingen påminnelseliste uten påminnelser", () => {
    expect(kort([lekse])).not.toContain("Påminnelser");
  });
});
