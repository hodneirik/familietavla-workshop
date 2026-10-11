import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Bunnmeny } from "./Bunnmeny";
import { Felt, Tekstfelt, Valgfelt } from "./Felt";
import { Infoboks } from "./Infoboks";
import { IkonKnapp, Knapp } from "./Knapp";
import { Kort } from "./Kort";
import { Merke } from "./Merke";
import { Toppmeny } from "./Toppmeny";

const bruker = {
  id: 1,
  visningsnavn: "Elias",
  rolle: "barn" as const,
  farge: "#82b797",
  emoji: "🦖",
};

describe("Knapp", () => {
  it("er en vanlig knapp som ikke sender skjemaet av seg selv", () => {
    const html = renderToStaticMarkup(<Knapp>Lagre</Knapp>);
    expect(html).toContain('type="button"');
    expect(html).toContain("knapp knapp--sekundær");
  });

  it("kan være primær og stor, og kan sende skjemaer", () => {
    const html = renderToStaticMarkup(
      <Knapp variant="primær" storrelse="stor" type="submit">
        Fullfør
      </Knapp>,
    );
    expect(html).toContain("knapp--primær knapp--stor");
    expect(html).toContain('type="submit"');
  });

  it("viser ikon foran teksten, skjult for skjermlesere", () => {
    const html = renderToStaticMarkup(<Knapp ikon="legg_til">Ny lapp</Knapp>);
    expect(html.indexOf("<svg")).toBeLessThan(html.indexOf("Ny lapp"));
    expect(html).toContain('aria-hidden="true"');
  });

  it("ikonknappen har alltid et navn", () => {
    const html = renderToStaticMarkup(
      <IkonKnapp ikon="slett" tittel="Slett lappen" variant="fare" />,
    );
    expect(html).toContain('aria-label="Slett lappen"');
    expect(html).toContain("knapp--ikon");
    expect(html).toContain("knapp--fare");
  });
});

describe("Kort og Merke", () => {
  it("kort kan være et listeelement og kan løftes", () => {
    const html = renderToStaticMarkup(
      <ul>
        <Kort som="li" løft>
          Hei
        </Kort>
      </ul>,
    );
    expect(html).toContain('<li class="kort kort--lopt">Hei</li>');
  });

  it("merke har tone og valgfritt ikon", () => {
    const html = renderToStaticMarkup(
      <Merke tone="sand" ikon="stjerne">
        5
      </Merke>,
    );
    expect(html).toContain("merke merke--sand");
    expect(html).toContain("<svg");
  });
});

describe("Felt", () => {
  it("knytter etikett, hjelp og feil til feltet", () => {
    const html = renderToStaticMarkup(
      <Tekstfelt etikett="Navn" hjelp="Slik står det på tavla" feil="Må fylles ut" />,
    );
    const id = /<input id="([^"]+)"/.exec(html)?.[1];
    expect(id).toBeTruthy();
    expect(html).toContain(`for="${id}"`);
    expect(html).toContain(`aria-describedby="${id}-hjelp ${id}-feil"`);
    expect(html).toContain('aria-invalid="true"');
    expect(html).toContain('role="alert"');
  });

  it("har ingen beskrivelse eller feilmerking når alt er i orden", () => {
    const html = renderToStaticMarkup(<Tekstfelt etikett="Navn" />);
    expect(html).not.toContain("aria-describedby");
    expect(html).not.toContain("aria-invalid");
  });

  it("virker for valg og kan gi egne felt via Felt", () => {
    expect(
      renderToStaticMarkup(
        <Valgfelt etikett="Rolle">
          <option>Barn</option>
        </Valgfelt>,
      ),
    ).toContain("<select");
    expect(
      renderToStaticMarkup(<Felt etikett="Tall">{(e) => <input type="number" {...e} />}</Felt>),
    ).toContain('type="number"');
  });
});

describe("Infoboks", () => {
  it("feil leses opp med en gang, resten er rolige statusmeldinger", () => {
    expect(renderToStaticMarkup(<Infoboks type="feil">Noe gikk galt</Infoboks>)).toContain(
      'role="alert"',
    );
    for (const type of ["info", "ok", "advarsel"] as const) {
      expect(renderToStaticMarkup(<Infoboks type={type}>Hei</Infoboks>)).toContain('role="status"');
    }
  });

  it("kan ha tittel", () => {
    const html = renderToStaticMarkup(<Infoboks tittel="Husk">Gymtøy</Infoboks>);
    expect(html).toContain("Husk");
    expect(html).toContain("infoboks--info");
  });
});

describe("Menyene", () => {
  const valg = [
    { id: "hjem", navn: "Hjem", ikon: "hjem" as const },
    { id: "meg", navn: "Meg", ikon: "meg" as const },
  ];

  it("bunnmenyen markerer aktiv fane og får profilfargen", () => {
    const html = renderToStaticMarkup(
      <Bunnmeny valg={valg} aktiv="meg" onVelg={() => {}} farge="#82b797" />,
    );
    expect(html).toContain("--meny-bg:#82b797");
    expect(html).toContain("--meny-fg:#1b1f27");
    expect(html.match(/aria-current="page"/g)).toHaveLength(1);
    expect(html).toContain('class="aktiv" aria-current="page"');
    expect(html).toContain('aria-label="Hovedmeny"');
  });

  it("toppmenyen viser hvem som er logget inn", () => {
    const html = renderToStaticMarkup(<Toppmeny bruker={bruker} onProfil={() => {}} />);
    expect(html).toContain("Familietavla");
    expect(html).toContain('aria-label="Min profil, Elias"');
    expect(html).toContain("🦖");
  });

  it("toppmenyen bruker forbokstaven når det ikke finnes emoji", () => {
    const html = renderToStaticMarkup(
      <Toppmeny bruker={{ ...bruker, emoji: null }} onProfil={() => {}} />,
    );
    expect(html).toContain(">E<");
  });
});
