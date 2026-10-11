import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { RetterForslagListe } from "./KiRetter";
import {
  antallValgtRetter,
  erRettKlar,
  lagRetterBody,
  lagRetterState,
  type RetterForslagSvar,
  type RetterResultat,
} from "./kiRetterLogikk";

const forslag: RetterForslagSvar = {
  sammendrag: "Enkle fiskeretter.",
  retter: [
    {
      forslagId: "r1",
      tittel: "Fiskegrateng",
      notat: "Ta ut fisken",
      ingredienser: ["fisk", "fløte"],
    },
    { forslagId: "r2", tittel: "Laksesuppe", notat: null, ingredienser: ["laks", "gulrot", "løk"] },
  ],
  advarsler: [],
  forkastet: 0,
};
const resultat: RetterResultat = { forslag, kostnad_ore: 9, brukt_ore: 30, tak_ore: 5000 };

describe("retter fra KI-en", () => {
  it("starter med alle valgt, ingredienser som linjer, og tomt notat som tom tekst", () => {
    const s = lagRetterState(forslag);
    expect(s.map((r) => r.valgt)).toEqual([true, true]);
    expect(s[0]!.ingredienser).toBe("fisk\nfløte");
    expect(s[1]!.notat).toBe("");
  });

  it("lager body bare for valgte, med rensede ingredienser og notat som null når det er tomt", () => {
    const s = lagRetterState(forslag);
    s[0] = { ...s[0]!, valgt: false };
    s[1] = { ...s[1]!, tittel: "  Laksesuppe ", ingredienser: "laks\n\n gulrot \n" };
    expect(lagRetterBody(s)).toEqual({
      retter: [
        { forslagId: "r2", tittel: "Laksesuppe", notat: null, ingredienser: ["laks", "gulrot"] },
      ],
    });
    expect(antallValgtRetter(s)).toBe(1);
  });

  it("en rett uten navn er ikke klar", () => {
    const s = lagRetterState(forslag);
    expect(erRettKlar(s[0]!)).toBe(true);
    expect(erRettKlar({ ...s[0]!, tittel: " " })).toBe(false);
  });

  it("viser forslagene med avkrysning, ingredienser og kostnad, og er avslått uten valgte", () => {
    const vis = (retter = lagRetterState(forslag)) =>
      renderToStaticMarkup(
        <RetterForslagListe
          resultat={resultat}
          retter={retter}
          opptatt={false}
          onRetter={() => {}}
          onLeggInn={() => {}}
          onAvbryt={() => {}}
        />,
      );
    const html = vis();
    expect(html).toContain("Legg til retten «Fiskegrateng»");
    expect(html).toContain("Ingredienser (én per linje)");
    expect(html).toContain("Legg til 2");
    expect(html).toContain("Kostet ca. 0,09 kr");
    const tom = vis([]);
    expect(tom).toContain("kom ikke med noen nye retter");
    expect(tom).toMatch(/disabled=""[^>]*>[^<]*(<[^>]*>)*[^<]*Legg til 0/);
  });
});
