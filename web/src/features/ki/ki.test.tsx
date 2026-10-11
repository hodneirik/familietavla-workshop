import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Advarsler, DuplikatVarsel } from "./Advarsler";
import { Forslag } from "./Forslag";
import { Fremdrift } from "./Fremdrift";
import { KiInnstillinger } from "./KiInnstillinger";
import { KiStatus } from "./KiStatus";
import { Opplasting } from "./Opplasting";
import { Resultat } from "./Resultat";
import { Spoersmaal } from "./Spoersmaal";
import {
  antallValgt,
  base64FraBytes,
  forslagReducer,
  kroner,
  lagForslagState,
  lagLeggInnBody,
  lagSvarListe,
  mangler,
  slaaSammenSvar,
  standardUke,
  ukeEtikett,
  ukevalg,
} from "./forslagLogikk";
import type { AnalyseResultat, KiStatusSvar } from "./typer";

const analyse = (over: Partial<AnalyseResultat["forslag"]> = {}): AnalyseResultat => ({
  kontrollsum: "a".repeat(64),
  kostnad_ore: 58,
  brukt_ore: 120,
  tak_ore: 5000,
  forslag: {
    ukeStart: "2026-10-05",
    sammendrag: "Turdag onsdag.",
    lekser: [
      {
        forslagId: "l1",
        barnIder: [2],
        barnNavn: ["Elias"],
        fag: "Engelsk",
        tittel: "Les teksten",
        fritekst: null,
        frist: "2026-10-08",
        usikker: false,
      },
      {
        forslagId: "l2",
        barnIder: [2],
        barnNavn: ["Elias"],
        fag: null,
        tittel: "Usikker lekse",
        fritekst: "?",
        frist: "2026-10-09",
        usikker: true,
      },
    ],
    avtaler: [
      {
        forslagId: "a1",
        kalenderId: 1,
        tittel: "Turdag",
        sted: null,
        helDag: true,
        start: "2026-10-07",
        slutt: null,
        gjentasUkentlig: false,
        barnNavn: [],
        usikker: false,
      },
      {
        forslagId: "a2",
        kalenderId: null,
        tittel: "Gym 5A",
        sted: "Gymsalen",
        helDag: false,
        start: "2026-10-12T08:30",
        slutt: "2026-10-12T09:30",
        gjentasUkentlig: true,
        barnNavn: ["Elias"],
        usikker: false,
      },
    ],
    paaminnelser: [
      {
        forslagId: "r1",
        barnIder: [2],
        barnNavn: ["Elias"],
        tittel: "Gym",
        ukedag: 1,
        dato: null,
        fra: null,
        til: null,
        usikker: false,
      },
      {
        forslagId: "r2",
        barnIder: [2],
        barnNavn: ["Elias"],
        tittel: "Svømming",
        ukedag: 2,
        dato: null,
        fra: "2026-10-14",
        til: "2026-11-04",
        usikker: false,
      },
      {
        forslagId: "r3",
        barnIder: [2],
        barnNavn: ["Elias"],
        tittel: "Turdag",
        ukedag: null,
        dato: "2026-10-16",
        fra: null,
        til: null,
        usikker: true,
      },
    ],
    lapper: [{ forslagId: "p1", tekst: "Klær etter vær", farge: "grønn" }],
    annet: [{ tittel: "Sosialt mål", tekst: "Vise respekt" }],
    spoersmaal: [],
    advarsler: [],
    forkastet: 0,
    ...over,
  },
});

describe("forslag: rene funksjoner", () => {
  it("velger neste uke fra fredag og denne uka ellers", () => {
    expect(standardUke("2026-10-07")).toBe("2026-10-05"); // onsdag
    expect(standardUke("2026-10-08")).toBe("2026-10-05"); // torsdag
    expect(standardUke("2026-10-09")).toBe("2026-10-12"); // fredag
    expect(standardUke("2026-10-11")).toBe("2026-10-12"); // søndag
  });

  it("tilbyr forrige, denne og de to neste ukene", () => {
    expect(ukevalg("2026-10-07")).toEqual(["2026-09-28", "2026-10-05", "2026-10-12", "2026-10-19"]);
  });

  it("koder bytes som base64, også store filer", () => {
    expect(base64FraBytes(new TextEncoder().encode("%PDF-1.4"))).toBe(btoa("%PDF-1.4"));
    const stor = new Uint8Array(200_000).fill(65);
    expect(atob(base64FraBytes(stor))).toHaveLength(200_000);
  });

  it("skriver kroner med komma", () => {
    expect(kroner(58)).toBe("0,58 kr");
    expect(kroner(5000)).toContain("50,00");
  });

  it("lager svarlisten bare for spørsmål som er besvart, og lar nye svar erstatte gamle", () => {
    const sp = [
      { id: "k", tekst: "Klasse?", valg: [] },
      { id: "u", tekst: "Hvilken uke?", valg: [] },
    ];
    expect(lagSvarListe(sp, { k: "5A" })).toEqual([
      { spoersmaalId: "k", spoersmaal: "Klasse?", svar: "5A" },
    ]);
    const alle = slaaSammenSvar(
      [
        { spoersmaalId: "k", spoersmaal: "Klasse?", svar: "5B" },
        { spoersmaalId: "x", spoersmaal: "X?", svar: "ja" },
      ],
      [{ spoersmaalId: "k", spoersmaal: "Klasse?", svar: "5A" }],
    );
    expect(alle.map((s) => `${s.spoersmaalId}:${s.svar}`)).toEqual(["x:ja", "k:5A"]);
  });
});

describe("forslag: redigering og legg-inn-body", () => {
  const start = () => lagForslagState(analyse());

  it("velger det som er sikkert og lar det usikre stå av", () => {
    const s = start();
    expect(s.lekser.map((l) => l.valgt)).toEqual([true, false]);
    expect(s.avtaler.map((a) => a.valgt)).toEqual([true, false]); // uten kalender er den ikke valgt
    expect(s.lapper.map((l) => l.valgt)).toEqual([true]);
    expect(s.avtaler[1]).toMatchObject({
      fra: "08:30",
      til: "09:30",
      dato: "2026-10-12",
      gjentas: true,
    });
    expect(s.avtaler[1]!.gjentasTil).toBe("2026-11-09");
  });

  it("lager påminnelser: faste, periode og enkeltdag, og lar den usikre stå av", () => {
    const s = start();
    expect(s.paaminnelser.map((p) => [p.slag, p.valgt])).toEqual([
      ["fast", true],
      ["fast", true],
      ["dag", false],
    ]);
    expect(s.paaminnelser[1]).toMatchObject({ ukedag: 2, fra: "2026-10-14", til: "2026-11-04" });
    expect(s.paaminnelser[2]).toMatchObject({ dato: "2026-10-16", fra: "", til: "" });
  });

  it("en enkeltdag sendes med dato og uten ukedag og periode", () => {
    let s = start();
    s = forslagReducer(s, { type: "veksle", gruppe: "paaminnelser", forslagId: "r3" });
    const r3 = lagLeggInnBody(s, "2026-10-05", "a".repeat(64)).paaminnelser.find(
      (p) => p.forslagId === "r3",
    );
    expect(r3).toEqual({
      forslagId: "r3",
      barnIder: [2],
      tittel: "Turdag",
      ukedag: null,
      dato: "2026-10-16",
      fra: null,
      til: null,
    });
  });

  it("forteller hva som mangler i en påminnelse", () => {
    let s = start();
    s = forslagReducer(s, { type: "veksle", gruppe: "paaminnelser", forslagId: "r3" });
    s = forslagReducer(s, {
      type: "endre",
      gruppe: "paaminnelser",
      forslagId: "r3",
      felt: "dato",
      verdi: "",
    });
    expect(mangler(s)).toContain("Velg dato for «Turdag».");
    s = forslagReducer(s, {
      type: "endre",
      gruppe: "paaminnelser",
      forslagId: "r2",
      felt: "til",
      verdi: "2026-10-01",
    });
    expect(mangler(s)).toContain("Perioden for «Svømming» slutter før den begynner.");
  });

  it("veksler, endrer og velger alle", () => {
    let s = start();
    s = forslagReducer(s, { type: "veksle", gruppe: "lekser", forslagId: "l2" });
    expect(s.lekser[1]!.valgt).toBe(true);
    s = forslagReducer(s, {
      type: "endre",
      gruppe: "lekser",
      forslagId: "l1",
      felt: "tittel",
      verdi: "Ny tittel",
    });
    expect(s.lekser[0]!.tittel).toBe("Ny tittel");
    s = forslagReducer(s, { type: "velgAlle", gruppe: "lekser", valgt: false });
    expect(s.lekser.every((l) => !l.valgt)).toBe(true);
  });

  it("gjør «annet» til en lapp og kutter den på 280 tegn", () => {
    let s = lagForslagState(analyse({ annet: [{ tittel: "A", tekst: "x".repeat(400) }] }));
    s = forslagReducer(s, { type: "annetTilLapp", indeks: 0 });
    expect(s.annet).toHaveLength(0);
    expect(s.lapper.at(-1)!.tekst).toHaveLength(280);
    expect(forslagReducer(s, { type: "annetTilLapp", indeks: 9 })).toBe(s);
  });

  it("forteller hva som mangler, og er klar når alt er på plass", () => {
    let s = start();
    s = forslagReducer(s, { type: "veksle", gruppe: "avtaler", forslagId: "a2" });
    expect(mangler(s)).toEqual(["Velg kalender for «Gym 5A»."]);
    s = forslagReducer(s, {
      type: "endre",
      gruppe: "avtaler",
      forslagId: "a2",
      felt: "kalenderId",
      verdi: 1,
    });
    expect(mangler(s)).toEqual([]);
    s = forslagReducer(s, {
      type: "endre",
      gruppe: "avtaler",
      forslagId: "a2",
      felt: "gjentasTil",
      verdi: "",
    });
    expect(mangler(s)[0]).toContain("gjentas");
    s = forslagReducer(s, { type: "velgAlle", gruppe: "lekser", valgt: false });
    s = forslagReducer(s, { type: "velgAlle", gruppe: "avtaler", valgt: false });
    s = forslagReducer(s, { type: "velgAlle", gruppe: "paaminnelser", valgt: false });
    s = forslagReducer(s, { type: "velgAlle", gruppe: "lapper", valgt: false });
    expect(antallValgt(s)).toBe(0);
    expect(mangler(s)).toEqual(["Velg minst ett forslag."]);
  });

  it("lager legg-inn-body bare for det som er valgt, med riktige tider", () => {
    let s = start();
    s = forslagReducer(s, { type: "veksle", gruppe: "avtaler", forslagId: "a2" });
    s = forslagReducer(s, {
      type: "endre",
      gruppe: "avtaler",
      forslagId: "a2",
      felt: "kalenderId",
      verdi: 3,
    });
    const b = lagLeggInnBody(s, "2026-10-05", "a".repeat(64));
    expect(b.lekser).toEqual([
      {
        forslagId: "l1",
        barnIder: [2],
        tittel: "Les teksten",
        fag: "Engelsk",
        fritekst: null,
        frist: "2026-10-08",
      },
    ]);
    expect(b.avtaler).toEqual([
      {
        forslagId: "a1",
        kalenderId: 1,
        tittel: "Turdag",
        sted: null,
        helDag: true,
        start: "2026-10-07",
        slutt: null,
        gjentas: null,
        gjentasTil: null,
      },
      {
        forslagId: "a2",
        kalenderId: 3,
        tittel: "Gym 5A",
        sted: "Gymsalen",
        helDag: false,
        start: "2026-10-12T08:30",
        slutt: "2026-10-12T09:30",
        gjentas: "ukentlig",
        gjentasTil: "2026-11-09",
      },
    ]);
    expect(b.lapper).toEqual([{ forslagId: "p1", tekst: "Klær etter vær", farge: "grønn" }]);
    expect(b.paaminnelser).toEqual([
      {
        forslagId: "r1",
        barnIder: [2],
        tittel: "Gym",
        ukedag: 1,
        dato: null,
        fra: null,
        til: null,
      },
      {
        forslagId: "r2",
        barnIder: [2],
        tittel: "Svømming",
        ukedag: 2,
        dato: null,
        fra: "2026-10-14",
        til: "2026-11-04",
      },
    ]);
    expect(b).toMatchObject({ ukeStart: "2026-10-05", kontrollsum: "a".repeat(64) });
  });
});

describe("KI-komponenter", () => {
  const status = (over: Partial<KiStatusSvar> = {}): KiStatusSvar => ({
    aktiv: true,
    modell: "claude-sonnet-5-5",
    brukt_ore: 120,
    tak_ore: 5000,
    antall: 3,
    ...over,
  });

  it("viser forbruk og tak, og forklarer hvorfor KI er av", () => {
    expect(renderToStaticMarkup(<KiStatus status={status()} />)).toContain("1,20 kr");
    expect(renderToStaticMarkup(<KiStatus status={status()} />)).toContain("50,00 kr");
    expect(
      renderToStaticMarkup(<KiStatus status={status({ aktiv: false, grunn: "mangler_nokkel" })} />),
    ).toContain("nøkkel");
    expect(
      renderToStaticMarkup(<KiStatus status={status({ aktiv: false, grunn: "avskrudd" })} />),
    ).toContain("skrudd av");
    expect(
      renderToStaticMarkup(<KiStatus status={status({ aktiv: false, grunn: "tak_naadd" })} />),
    ).toContain("Månedstaket er nådd");
    expect(renderToStaticMarkup(<KiStatus status={null} />)).toBe("");
  });

  it("viser fremdrift som en opplest statusmelding", () => {
    const html = renderToStaticMarkup(<Fremdrift tekst="Leser ukeplanen" />);
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain("Leser ukeplanen");
  });

  const opplasting = (over: Partial<Parameters<typeof Opplasting>[0]> = {}) =>
    renderToStaticMarkup(
      <Opplasting
        pdf={null}
        uke="2026-10-05"
        idag="2026-10-07"
        barn={[
          { id: 2, navn: "Elias", klasse: "5A" },
          { id: 3, navn: "Nelly", klasse: null },
        ]}
        barnIder={[2]}
        aktiv
        opptatt={false}
        onFil={() => {}}
        onUke={() => {}}
        onBarn={() => {}}
        onStart={() => {}}
        {...over}
      />,
    );

  it("skriver uka som «Uke 41: 05.10 - 11.10», også over årsskiftet", () => {
    expect(ukeEtikett("2026-10-05")).toBe("Uke 41: 05.10 - 11.10");
    expect(ukeEtikett("2026-12-28")).toBe("Uke 53: 28.12 - 03.01");
    expect(ukeEtikett("2027-01-04")).toBe("Uke 1: 04.01 - 10.01");
  });

  it("starter uten barn valgt", () => {
    const html = opplasting({ barnIder: [] });
    expect(html).not.toContain("checked");
    expect(html).toMatch(/<button[^>]*disabled[^>]*>[^<]*(<[^>]*>)*[^<]*Les ukeplanen/);
  });

  it("lar deg velge fil, uke og barn, og er avslått uten fil", () => {
    const html = opplasting();
    expect(html).toContain('type="file"');
    expect(html).toContain("application/pdf");
    expect(html).toContain("Elias (5A)");
    // Uke først og datoene etter, og uke 41 2026 er 05.10 til 11.10
    expect(html).toContain("Uke 41: 05.10 - 11.10");
    expect(html).toContain("Uke 40: 28.09 - 04.10");
    expect(html).toContain("Uke 43: 19.10 - 25.10");
    expect(html).not.toContain("denne uka");
    expect(html).toMatch(/<button[^>]*disabled[^>]*>[^<]*(<[^>]*>)*[^<]*Les ukeplanen/);
    expect(opplasting({ pdf: { navn: "uke41.pdf", base64: "x" } })).toContain("Valgt: uke41.pdf");
    expect(opplasting({ pdf: { navn: "u.pdf", base64: "x" } })).not.toMatch(
      /disabled=""[^>]*>[^<]*(<[^>]*>)*[^<]*Les ukeplanen/,
    );
  });

  it("viser «Hopp over» bare én gang, også når KI-en selv har lagt det inn", () => {
    const html = renderToStaticMarkup(
      <Spoersmaal
        sporsmaal={[
          {
            id: "k",
            tekst: "Hvilken gruppe?",
            valg: [
              { id: "a", tekst: "Gruppe 1" },
              { id: "b", tekst: "Hopp over" },
              { id: "c", tekst: "Gruppe 1" },
            ],
          },
        ]}
        valgt={{}}
        opptatt={false}
        onVelg={() => {}}
        onSend={() => {}}
        onVisForslag={() => {}}
      />,
    );
    expect(html.match(/>Hopp over</g)).toHaveLength(1);
    expect(html.match(/>Gruppe 1</g)).toHaveLength(1);
    expect(html.indexOf("Gruppe 1")).toBeLessThan(html.indexOf("Hopp over"));
  });

  it("stiller spørsmål med svarknapper og «Hopp over» som alltid er et valg", () => {
    const html = renderToStaticMarkup(
      <Spoersmaal
        sporsmaal={[
          {
            id: "k",
            tekst: "Er dere i 5A eller 5B?",
            valg: [
              { id: "a", tekst: "5A" },
              { id: "b", tekst: "5B" },
            ],
          },
        ]}
        valgt={{ k: "5A" }}
        opptatt={false}
        onVelg={() => {}}
        onSend={() => {}}
        onVisForslag={() => {}}
      />,
    );
    expect(html).toContain("Er dere i 5A eller 5B?");
    expect(html).toContain('role="radiogroup"');
    expect(html).toContain('aria-checked="true"');
    expect(html).toContain("Hopp over");
    expect(html).toContain("Oppdater forslagene");
  });

  it("viser forslagene i grupper med avkrysning, kalender og felt som kan rettes", () => {
    const html = renderToStaticMarkup(
      <Forslag
        state={lagForslagState(analyse())}
        kalendere={[{ id: 1, navn: "Familie" }]}
        send={() => {}}
      />,
    );
    for (const t of [
      "Lekser",
      "Avtaler",
      "Lapper",
      "Annet",
      "Les teksten",
      "Turdag",
      "Klær etter vær",
      "Gjør til lapp",
      "Usikker",
      "Familie",
    ]) {
      expect(html, t).toContain(t);
    }
    expect(html).toContain("Legg inn leksa «Les teksten»");
    expect(html).toContain('aria-label="Foreslåtte påminnelser"');
    expect(html).toContain("Legg inn påminnelsen «Gym»");
    expect(html).toContain("Bare én bestemt dag");
    expect(html).toContain("Siste dag"); // perioden til svømmingen vises
    expect(html).toContain('type="date"');
    expect(html).toContain('type="time"');
    expect(html).toContain("0 av 280 tegn".replace("0", "14"));
  });

  it("sier fra når KI-en ikke fant noe", () => {
    const tom = lagForslagState(
      analyse({ lekser: [], avtaler: [], paaminnelser: [], lapper: [], annet: [] }),
    );
    expect(renderToStaticMarkup(<Forslag state={tom} kalendere={[]} send={() => {}} />)).toContain(
      "ikke noe å legge inn",
    );
  });

  it("viser duplikatvarsel, advarsler og hvor mange som ble forkastet", () => {
    const d = renderToStaticMarkup(
      <DuplikatVarsel
        duplikat={{ innlagt: "2026-10-06T10:00:00Z", av: "Anita" }}
        onLastLikevel={() => {}}
      />,
    );
    expect(d).toContain("lagt inn før");
    expect(d).toContain("av Anita");
    expect(d).toContain("Les den likevel");
    const a = renderToStaticMarkup(<Advarsler advarsler={["Sjekk datoene"]} forkastet={3} />);
    expect(a).toContain("Sjekk datoene");
    expect(a).toContain("3 forslag ble");
    expect(renderToStaticMarkup(<Advarsler advarsler={[]} forkastet={0} />)).toBe("");
  });

  it("viser resultatet med antall og feil per rad", () => {
    const html = renderToStaticMarkup(
      <Resultat
        onNy={() => {}}
        svar={{
          antallOk: 2,
          rader: [
            { forslagId: "l1", type: "lekse", ok: true },
            { forslagId: "r1", type: "paaminnelse", ok: true },
            { forslagId: "p1", type: "lapp", ok: true },
            { forslagId: "a1", type: "avtale", ok: false, feil: "Ukjent kalender" },
          ],
        }}
      />,
    );
    expect(html).toContain("1 lekse, 0 avtaler, 1 påminnelse og 1 lapp");
    expect(html).toContain("Ukjent kalender");
    expect(html).toContain("Les en ny plan");
  });

  it("viser innstillinger med klasse per barn, regler og kalender, og sier at navn byttes ut", () => {
    const html = renderToStaticMarkup(
      <KiInnstillinger
        onLagre={async () => {}}
        innst={{
          voksne: 1,
          middagRegler: "Ingen sopp",
          barn: [
            { id: 2, navn: "Elias", klasse: "5A" },
            { id: 3, navn: "Nelly", klasse: null },
          ],
          regler: "Ta med gym",
          standardKalenderId: 1,
          kalendere: [{ id: 1, navn: "Familie" }],
        }}
      />,
    );
    expect(html).toContain("Klasse for Elias");
    expect(html).toContain('value="5A"');
    expect(html).toContain("Ta med gym");
    expect(html).toContain("barn A");
    expect(html).toContain("Anthropic");
    expect(html).toContain("Faste regler for middag");
    expect(html).toContain("Faste regler for ukeplanen");
    expect(html).toContain("Ingen sopp");
    expect(html).toContain("Voksne som spiser middag");
    expect(html).toContain("Barna telles fra familien (2)");
  });
});
