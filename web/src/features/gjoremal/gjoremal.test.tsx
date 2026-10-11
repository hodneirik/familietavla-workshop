import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { Oppgave } from "../../lib/types";
import { FerdigListe } from "./Gjoremal";
import { PoengKort } from "./Poeng";

const barn = {
  id: 2,
  visningsnavn: "Elias",
  rolle: "barn" as const,
  farge: "#82b797",
  emoji: "🦖",
};

describe("PoengKort", () => {
  it("viser godkjente poeng med en stjerne, og navn bare når det ønskes", () => {
    const med = renderToStaticMarkup(
      <PoengKort status={{ bruker: barn, poeng: 25, klare: 0 }} navn />,
    );
    expect(med).toContain("25 poeng");
    expect(med).toContain("Elias");
    expect(med).toContain("<svg");
    expect(med).not.toContain("venter på godkjenning");
    expect(
      renderToStaticMarkup(<PoengKort status={{ bruker: barn, poeng: 25, klare: 0 }} />),
    ).not.toContain("Elias");
  });

  it("viser poeng som venter på godkjenning med klokke", () => {
    const html = renderToStaticMarkup(<PoengKort status={{ bruker: barn, poeng: 0, klare: 15 }} />);
    expect(html).toContain("+15 venter på godkjenning");
    expect(html.match(/<svg/g)?.length).toBe(2);
  });
});

describe("FerdigListe", () => {
  const oppgave = (id: number, tittel: string): Oppgave => ({
    id,
    tittel,
    poeng: 10,
    gjentas: null,
    ledigFra: null,
    opprettetAv: 1,
    status: "godkjent",
    opprettet: "",
    tatt: null,
    fullfort: null,
    godkjent: "",
    eier: barn,
  });

  it("viser godkjente gjøremål som tette rader uten kort", () => {
    const html = renderToStaticMarkup(
      <FerdigListe
        oppgaver={[oppgave(1, "Dekke bordet"), oppgave(2, "Rydde rommet")]}
        kanStyre={() => false}
        onSlett={() => {}}
      />,
    );
    expect(html.match(/class="ferdigrad"/g)).toHaveLength(2);
    expect(html).toContain("Dekke bordet");
    expect(html).toContain("Elias");
    expect(html).toContain("+10");
    expect(html).not.toContain('class="oppgave');
    expect(html).not.toContain("Slett");
  });

  it("gir slettknapp bare til dem som styrer gjøremålet", () => {
    const html = renderToStaticMarkup(
      <FerdigListe
        oppgaver={[oppgave(1, "Dekke bordet"), oppgave(2, "Rydde rommet")]}
        kanStyre={(o) => o.id === 1}
        onSlett={() => {}}
      />,
    );
    expect(html).toContain("Slett Dekke bordet");
    expect(html).not.toContain("Slett Rydde rommet");
  });

  it("viser ingenting når det ikke finnes ferdige gjøremål", () => {
    expect(
      renderToStaticMarkup(<FerdigListe oppgaver={[]} kanStyre={() => true} onSlett={() => {}} />),
    ).toBe("");
  });
});
