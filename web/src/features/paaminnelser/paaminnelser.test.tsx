import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { Paaminnelse } from "../../lib/types";
import { PaaminnelseLinje } from "./PaaminnelseLinje";
import {
  enkeltdagTekst,
  grupperPaaminnelser,
  paaminnelserForDag,
  periodetekst,
} from "./paaminnelser";

const barn = (id: number, visningsnavn: string) => ({
  id,
  visningsnavn,
  farge: "#82b797",
  emoji: null,
});
const p = (
  id: number,
  b: ReturnType<typeof barn>,
  tittel: string,
  ukedag: number | null,
  ekstra: Partial<Paaminnelse> = {},
): Paaminnelse => ({ id, barn: b, tittel, ukedag, dato: null, fra: null, til: null, ...ekstra });
const haakon = barn(2, "Elias");
const nelly = barn(3, "Nelly");

// 13. oktober 2026 er en tirsdag (ukedag 1)
describe("paaminnelserForDag", () => {
  it("tar bare påminnelsene for ukedagen, sortert etter tittel og barn", () => {
    const alle = [
      p(1, nelly, "Gym", 1),
      p(2, haakon, "Gym", 1),
      p(3, haakon, "Bibliotek", 1),
      p(4, haakon, "Gym", 3),
    ];
    expect(paaminnelserForDag(alle, "2026-10-13").map((x) => x.id)).toEqual([3, 2, 1]);
    expect(paaminnelserForDag(alle, "2026-10-12")).toEqual([]);
  });

  it("en enkeltdag gjelder bare på sin dato", () => {
    const tur = p(1, haakon, "Turdag", null, { dato: "2026-10-16" });
    expect(paaminnelserForDag([tur], "2026-10-16")).toHaveLength(1);
    expect(paaminnelserForDag([tur], "2026-10-09")).toHaveLength(0);
    expect(paaminnelserForDag([tur], "2026-10-23")).toHaveLength(0);
  });

  it("en fast ukedag i en periode gjelder bare mellom første og siste dag", () => {
    const svomming = p(1, haakon, "Svømming", 2, { fra: "2026-10-14", til: "2026-10-28" });
    for (const [dato, venta] of [
      ["2026-10-07", 0],
      ["2026-10-14", 1],
      ["2026-10-21", 1],
      ["2026-10-28", 1],
      ["2026-11-04", 0],
      ["2026-10-15", 0],
    ] as const) {
      expect(paaminnelserForDag([svomming], dato), dato).toHaveLength(venta);
    }
    const bareFra = p(2, haakon, "Fra", 2, { fra: "2026-10-14" });
    expect(paaminnelserForDag([bareFra], "2027-01-06")).toHaveLength(1);
    expect(paaminnelserForDag([bareFra], "2026-10-07")).toHaveLength(0);
  });
});

describe("periodetekst og enkeltdagTekst", () => {
  it("skriver perioden i ord", () => {
    expect(periodetekst({ fra: null, til: null })).toBe("");
    expect(periodetekst({ fra: "2026-10-14", til: "2026-11-04" })).toBe("14. okt. til 4. nov.");
    expect(periodetekst({ fra: "2026-10-14", til: null })).toBe("fra 14. okt.");
    expect(periodetekst({ fra: null, til: "2026-11-04" })).toBe("til 4. nov.");
  });
  it("skriver enkeltdagen med ukedag", () => {
    expect(enkeltdagTekst("2026-10-16")).toBe("Fre 16. okt.");
  });
});

describe("grupperPaaminnelser", () => {
  it("slår sammen like titler og samler barna", () => {
    const g = grupperPaaminnelser([p(1, haakon, "Gym", 1), p(2, nelly, "gym", 1)], true);
    expect(g).toEqual([{ tittel: "Gym", barn: ["Elias", "Nelly"] }]);
  });
  it("utelater navnene i barnets egen visning", () => {
    expect(grupperPaaminnelser([p(1, haakon, "Gym", 1)], false)).toEqual([
      { tittel: "Gym", barn: [] },
    ]);
  });
});

describe("PaaminnelseLinje", () => {
  it("viser ingenting uten påminnelser", () => {
    expect(renderToStaticMarkup(<PaaminnelseLinje paaminnelser={[]} medBarn />)).toBe("");
  });
  it("viser én liten liste med navn for voksne", () => {
    const html = renderToStaticMarkup(
      <PaaminnelseLinje paaminnelser={[p(1, haakon, "Gym", 1), p(2, nelly, "Gym", 1)]} medBarn />,
    );
    expect(html).toContain('aria-label="Påminnelser"');
    expect(html).toContain("Gym");
    expect(html).toContain("Elias, Nelly");
    expect(html.match(/<li/g)).toHaveLength(1);
  });
  it("viser ikke navn for barnet selv", () => {
    const html = renderToStaticMarkup(
      <PaaminnelseLinje paaminnelser={[p(1, haakon, "Bibliotek", 1)]} medBarn={false} />,
    );
    expect(html).toContain("Bibliotek");
    expect(html).not.toContain("Elias");
  });
});
