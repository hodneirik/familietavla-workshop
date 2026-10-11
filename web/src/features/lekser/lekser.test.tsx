import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { Lekse } from "../../lib/types";
import { LekseRad } from "./LekseRad";

const lekse: Lekse = {
  id: 1,
  barn: { id: 2, visningsnavn: "Elias", farge: "#82b797", emoji: "🦖" },
  fag: "Norsk",
  tittel: "Les side 40 til 45",
  fritekst: "Husk leseboka.",
  frist: "2026-10-08",
  gjort: false,
};
const rad = (l: Lekse, forelder: boolean, forfalt = false) =>
  renderToStaticMarkup(
    <ul>
      <LekseRad
        l={l}
        forelder={forelder}
        forfalt={forfalt}
        onEndret={async () => {}}
        onFeil={() => {}}
      />
    </ul>,
  );

describe("LekseRad", () => {
  it("viser tittel med fag i parentes og fritekst under, med en boks som kan krysses av", () => {
    const html = rad(lekse, false);
    expect(html).toContain("Les side 40 til 45");
    expect(html).toContain("(Norsk)");
    expect(html).toContain("Husk leseboka.");
    expect(html).toContain('type="checkbox"');
    expect(html).not.toContain("checked");
  });

  it("barn ser ikke navn og endringsknapper, voksne gjør", () => {
    expect(rad(lekse, false)).not.toContain("Elias");
    expect(rad(lekse, false)).not.toContain("Endre Les side");
    const voksen = rad(lekse, true);
    expect(voksen).toContain("Elias");
    expect(voksen).toContain("Endre Les side 40 til 45");
    expect(voksen).toContain("Slett Les side 40 til 45");
  });

  it("markerer gjort og forfalt", () => {
    expect(rad({ ...lekse, gjort: true }, false)).toContain("lekse gjort");
    expect(rad(lekse, false, true)).toContain("Forfalt.");
  });

  it("i oversikten på Hjem har raden bare avkrysning, uten endre og slette", () => {
    const html = renderToStaticMarkup(
      <ul>
        <LekseRad l={lekse} forelder utenHandlinger onEndret={async () => {}} onFeil={() => {}} />
      </ul>,
    );
    expect(html).toContain('type="checkbox"');
    expect(html).not.toContain("Endre");
    expect(html).not.toContain("Slett");
    expect(html).toContain("Elias");
  });
});
