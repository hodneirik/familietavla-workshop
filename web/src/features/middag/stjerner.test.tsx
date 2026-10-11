import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Score, Snitt, StjerneRekke, StjerneVelger } from "./Stjerner";

describe("stjerner", () => {
  it("rekken sier hvor mange stjerner det er, og fyller like mange", () => {
    const html = renderToStaticMarkup(<StjerneRekke verdi={3} />);
    expect(html).toContain('aria-label="3 av 5 stjerner"');
    expect(html.match(/fill="currentColor"/g)).toHaveLength(3);
    expect(html.match(/fill="none"/g)).toHaveLength(2);
  });

  it("velgeren fyller stjernene opp til valgt verdi og markerer bare den valgte", () => {
    const html = renderToStaticMarkup(<StjerneVelger verdi={4} onVelg={() => {}} />);
    expect(html.match(/fill="currentColor"/g)).toHaveLength(4);
    expect(html.match(/aria-checked="true"/g)).toHaveLength(1);
    expect(html).toContain('aria-label="1 stjerne"');
  });

  it("velgeren uten verdi har ingen fylte stjerner", () => {
    const html = renderToStaticMarkup(<StjerneVelger verdi={null} onVelg={() => {}} />);
    expect(html).not.toContain('fill="currentColor"');
  });

  it("snittet bruker komma og riktig flertall", () => {
    expect(renderToStaticMarkup(<Snitt snitt={4.33} antall={7} />)).toContain("4,3");
    expect(renderToStaticMarkup(<Snitt snitt={5} antall={1} />)).toContain("1 stemme)");
    expect(renderToStaticMarkup(<Snitt snitt={null} antall={0} />)).toContain("Ingen stemmer ennå");
  });

  it("scoren vises med fylt stjerne og komma", () => {
    const html = renderToStaticMarkup(<Score verdi={3.5} />);
    expect(html).toContain("3,5");
    expect(html).toContain('fill="currentColor"');
  });
});
