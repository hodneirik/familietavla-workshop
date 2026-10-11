import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { iDag } from "../../lib/dato";
import { dagerTilSondag } from "../dagsliste/tid";
import type { Lekse } from "../../lib/types";
import { Kommende, lekserForDag } from "./Kommende";

describe("Kommende", () => {
  const html = renderToStaticMarkup(<Kommende />);

  it("viser én dag per kort fra i dag til og med nærmeste søndag", () => {
    expect(html).toContain("De neste dagene");
    expect(html.match(/class="ukedag( idag)?"/g)).toHaveLength(dagerTilSondag(iDag()).length);
    expect(html.match(/ukedag idag/g)).toHaveLength(1);
  });

  it("middagen kan bare gis stjerner når Hjem sier at brukeren er et barn", () => {
    expect(html).not.toContain("Trykk for å gi stjerner");
  });

  it("har samme utseende som uka, men ingen bla-knapper", () => {
    expect(html).toContain('class="ukevisning"');
    expect(html).not.toContain("Forrige uke");
    expect(html).not.toContain("Neste uke");
    expect(html).not.toContain("I dag</button>");
  });
});

const lekse = (id: number, barn: string, barnId: number, frist: string, gjort = false): Lekse => ({
  id,
  barn: { id: barnId, visningsnavn: barn, farge: "#82b797", emoji: null },
  fag: null,
  tittel: `Lekse ${id}`,
  fritekst: null,
  frist,
  gjort,
});

describe("lekserForDag", () => {
  it("sorterer alltid etter barn, uansett rekkefølgen fra serveren", () => {
    const lekser = [
      lekse(1, "Nelly", 3, "2026-10-08"),
      lekse(2, "Elias", 2, "2026-10-08"),
      lekse(3, "Nelly", 3, "2026-10-08"),
      lekse(4, "Elias", 2, "2026-10-08"),
    ];
    expect(lekserForDag(lekser, "2026-10-08", "2026-10-07").map((l) => l.id)).toEqual([2, 4, 1, 3]);
  });

  it("tar med forfalte lekser bare på dagens kort, også sortert etter barn, og eldste frist først", () => {
    const lekser = [
      lekse(1, "Nelly", 3, "2026-10-07"),
      lekse(2, "Elias", 2, "2026-10-07"),
      lekse(3, "Elias", 2, "2026-10-05"),
      lekse(4, "Nelly", 3, "2026-10-04", true),
    ];
    expect(lekserForDag(lekser, "2026-10-07", "2026-10-07").map((l) => l.id)).toEqual([3, 2, 1]);
    expect(lekserForDag(lekser, "2026-10-08", "2026-10-07")).toEqual([]);
  });
});
