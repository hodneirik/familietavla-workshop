import { describe, expect, it } from "vitest";
import type { Hendelse } from "../../lib/types";
import { dagBeskrivelse } from "./Calendar";

const h = (id: number, tittel: string): Hendelse => ({
  id,
  kalenderId: 1,
  tittel,
  start: "2026-10-12T17:00",
  slutt: "2026-10-12T18:00",
  helDag: false,
  sted: null,
  kilde: "manuell",
  gjentas: null,
  gjentasTil: null,
  startOriginal: "2026-10-12T17:00",
  sluttOriginal: "2026-10-12T18:00",
});

describe("dagBeskrivelse", () => {
  it("sier fra når dagen er tom", () => {
    expect(dagBeskrivelse("2026-10-12", [])).toBe("Mandag 12. oktober, ingen avtaler");
  });

  it("bruker entall for én avtale og nevner hva den heter", () => {
    expect(dagBeskrivelse("2026-10-12", [h(1, "Fotball")])).toBe(
      "Mandag 12. oktober, 1 avtale: Fotball",
    );
  });

  it("nevner alle avtalene, også de som ikke får plass i cellen", () => {
    const hendelser = ["A", "B", "C", "D", "E"].map((t, i) => h(i, t));
    expect(dagBeskrivelse("2026-10-12", hendelser)).toBe(
      "Mandag 12. oktober, 5 avtaler: A, B, C, D, E",
    );
  });
});
