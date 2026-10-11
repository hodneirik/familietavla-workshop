import { describe, expect, it } from "vitest";
import { medNavn, parseIngrediens, summerMengder } from "../src/core/ingrediens.js";

describe("parseIngrediens", () => {
  it("tolker mengde, enhet og navn", () => {
    expect(parseIngrediens("400 g kjøttdeig")).toEqual({
      navn: "kjøttdeig",
      mengde: 400,
      enhet: "g",
      mengdetekst: "400 g",
    });
    expect(parseIngrediens("1,5 dl fløte")).toMatchObject({
      mengde: 1.5,
      enhet: "dl",
      navn: "fløte",
    });
    expect(parseIngrediens("1/2 løk")).toMatchObject({ mengde: 0.5, enhet: null, navn: "løk" });
    expect(parseIngrediens("½ agurk")).toMatchObject({ mengde: 0.5, navn: "agurk" });
    expect(parseIngrediens("2 pakker tortilla")).toMatchObject({
      mengde: 2,
      enhet: "pk",
      navn: "tortilla",
    });
    expect(parseIngrediens("2 egg")).toMatchObject({ mengde: 2, enhet: null, navn: "egg" });
    expect(parseIngrediens("  3   stk   salat ")).toMatchObject({
      mengde: 3,
      enhet: "stk",
      navn: "salat",
    });
  });

  it("lar linjer uten mengde stå som de er", () => {
    expect(parseIngrediens("salt")).toEqual({
      navn: "salt",
      mengde: null,
      enhet: null,
      mengdetekst: "",
    });
    expect(parseIngrediens("Isbergsalat")).toMatchObject({ mengde: null, navn: "Isbergsalat" });
    // Ukjent form: tolkes ikke
    expect(parseIngrediens("3-4 poteter")).toMatchObject({ mengde: null, navn: "3-4 poteter" });
    expect(parseIngrediens("0 g sukker")).toMatchObject({ mengde: null });
  });

  it("bygger linjen på nytt med et annet navn", () => {
    expect(medNavn(parseIngrediens("2 stk salat"), "Isbergsalat")).toBe("2 stk Isbergsalat");
    expect(medNavn(parseIngrediens("salat"), "Isbergsalat")).toBe("Isbergsalat");
  });
});

describe("summerMengder", () => {
  const s = (...linjer: string[]) => summerMengder(linjer.map(parseIngrediens));
  it("legger sammen vekt og volum på tvers av enheter, og skriver pent", () => {
    expect(s("400 g kjøttdeig", "200 g kjøttdeig")).toBe("600 g");
    expect(s("700 g poteter", "500 g poteter")).toBe("1,2 kg");
    expect(s("1 kg mel", "500 g mel")).toBe("1,5 kg");
    expect(s("2 dl fløte", "3 dl fløte")).toBe("5 dl");
    expect(s("2 dl melk", "5 dl melk")).toBe("7 dl");
    expect(s("5 dl melk", "5 dl melk", "5 dl melk")).toBe("1,5 l");
    expect(s("125 ml fløte", "1 dl fløte")).toBe("225 ml");
  });
  it("regner et tall uten enhet som stykker, og holder ulike slag fra hverandre", () => {
    expect(s("2 egg", "4 stk egg")).toBe("6 stk");
    expect(s("1 stk salat", "200 g salat")).toBe("1 stk + 200 g");
    expect(s("1 pk tortilla", "1 pk tortilla")).toBe("2 pk");
  });
  it("sier «og mer» når noe mangler mengde, og null når ingen har mengde", () => {
    expect(s("1 stk salat", "salat")).toBe("1 stk og mer");
    expect(s("salat", "salat")).toBeNull();
    expect(summerMengder([])).toBeNull();
  });
});
