import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { Rett } from "../../lib/types";
import { ForslagListe } from "./KiMiddag";
import {
  antallValgt,
  erKlar,
  lagMiddagBody,
  lagMiddagState,
  tidsromDatoer,
  type MiddagForslagSvar,
  type MiddagResultat,
} from "./kiMiddag";

const forslag: MiddagForslagSvar = {
  fra: "2026-10-08",
  til: "2026-10-11",
  sammendrag: "En rolig uke med fisk og taco.",
  dager: [
    {
      forslagId: "m1",
      dato: "2026-10-08",
      rettId: 5,
      tittel: "Laks",
      snitt: 4.5,
      ny: false,
      ingredienser: [],
      gjenbruk: ["salat"],
      begrunnelse: "Høy score og ikke servert på tre uker",
    },
    {
      forslagId: "m2",
      dato: "2026-10-09",
      rettId: null,
      tittel: "Fiskesuppe",
      snitt: null,
      ny: true,
      ingredienser: ["400 g fisk", "1 stk løk"],
      gjenbruk: [],
      begrunnelse: "Noe nytt",
    },
  ],
  advarsler: [],
  forkastet: 0,
};
const resultat: MiddagResultat = { forslag, kostnad_ore: 12, brukt_ore: 40, tak_ore: 5000 };
const retter = [
  { id: 5, tittel: "Laks", snitt: 4.5, antall: 4, minSnitt: null, minAntall: 0 },
  { id: 6, tittel: "Taco", snitt: null, antall: 0, minSnitt: null, minAntall: 0 },
] as unknown as Rett[];

describe("tidsromDatoer", () => {
  // 8. oktober 2026 er en torsdag
  it("resten av uka går til søndag, neste uke er mandag til søndag, og sju dager er sju dager", () => {
    expect(tidsromDatoer("2026-10-08", "resten")).toEqual({ fra: "2026-10-08", til: "2026-10-11" });
    expect(tidsromDatoer("2026-10-08", "neste")).toEqual({ fra: "2026-10-12", til: "2026-10-18" });
    expect(tidsromDatoer("2026-10-08", "sju")).toEqual({ fra: "2026-10-08", til: "2026-10-14" });
  });
  it("resten av uka på en søndag er bare søndagen", () => {
    expect(tidsromDatoer("2026-10-11", "resten")).toEqual({ fra: "2026-10-11", til: "2026-10-11" });
  });
});

describe("forslag fra KI-en", () => {
  it("starter med alle dagene valgt, og skiller eksisterende og ny rett", () => {
    const s = lagMiddagState(forslag);
    expect(s.map((d) => [d.rett, d.valgt])).toEqual([
      [5, true],
      ["ny", true],
    ]);
    expect(s[1]!.ny).toEqual({ tittel: "Fiskesuppe", ingredienser: ["400 g fisk", "1 stk løk"] });
  });

  it("lager legg-inn-body bare for valgte dager, med riktig rett eller ny rett", () => {
    const s = lagMiddagState(forslag);
    s[0] = { ...s[0]!, valgt: false };
    expect(lagMiddagBody(s, true)).toEqual({
      paaHandleliste: true,
      dager: [
        {
          forslagId: "m2",
          dato: "2026-10-09",
          ny: { tittel: "Fiskesuppe", ingredienser: ["400 g fisk", "1 stk løk"] },
        },
      ],
    });
    // Byttes til en rett som finnes, sendes rettId
    s[1] = { ...s[1]!, rett: 6 };
    expect(lagMiddagBody(s, false).dager[0]).toEqual({
      forslagId: "m2",
      dato: "2026-10-09",
      rettId: 6,
    });
    expect(antallValgt(s)).toBe(1);
  });

  it("en ny rett uten navn er ikke klar", () => {
    const s = lagMiddagState(forslag);
    expect(erKlar(s[1]!)).toBe(true);
    expect(erKlar({ ...s[1]!, ny: { tittel: " ", ingredienser: [] } })).toBe(false);
  });
});

describe("ForslagListe", () => {
  const vis = (over: Partial<Parameters<typeof ForslagListe>[0]> = {}) =>
    renderToStaticMarkup(
      <ForslagListe
        resultat={resultat}
        dager={lagMiddagState(forslag)}
        retter={retter}
        paaHandleliste={false}
        opptatt={false}
        onDager={() => {}}
        onHandleliste={() => {}}
        onLeggInn={() => {}}
        onAvbryt={() => {}}
        {...over}
      />,
    );

  it("viser dagene med avkrysning, rett, begrunnelse og ny rett med ingredienser", () => {
    const html = vis();
    expect(html).toContain("Planlegg Tor 8. okt.");
    expect(html).toContain("Høy score og ikke servert på tre uker");
    expect(html).toContain("Fiskesuppe (ny rett)");
    expect(html).toContain("Ingredienser: 400 g fisk, 1 stk løk");
    expect(html).toContain("Bruker opp: salat");
    expect(html).toContain("Legg ingrediensene på handlelisten");
    expect(html).toContain("Legg inn 2");
    expect(html).toContain("Kostet ca. 0,12 kr");
    expect(html).toContain("En rolig uke");
  });

  it("er avslått uten valgte dager, og sier fra når KI-en ikke foreslo noe", () => {
    const tom = vis({ dager: [] });
    expect(tom).toContain("kom ikke med noe forslag");
    expect(tom).not.toContain("Legg ingrediensene");
    expect(tom).toMatch(/disabled=""[^>]*>[^<]*(<[^>]*>)*[^<]*Legg inn 0/);
  });
});
