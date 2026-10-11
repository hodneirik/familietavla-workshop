import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Ikon } from "./Ikon";
import { IKONER } from "./ikoner";

describe("Ikon", () => {
  it("er skjult for skjermlesere når det bare er pynt", () => {
    const html = renderToStaticMarkup(<Ikon navn="hjem" />);
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain('width="20"');
  });

  it("får rolle og navn når det står alene", () => {
    const html = renderToStaticMarkup(<Ikon navn="slett" tittel="Slett" storrelse="l" />);
    expect(html).toContain('role="img"');
    expect(html).toContain('aria-label="Slett"');
    expect(html).toContain('width="24"');
  });

  it("har strek på 1,75 som i designsystemet", () => {
    expect(renderToStaticMarkup(<Ikon navn="stjerne" />)).toContain('stroke-width="1.75"');
  });

  it("alle ikonnavn peker på en komponent", () => {
    for (const [navn, ikon] of Object.entries(IKONER)) {
      expect(ikon, navn).toBeTruthy();
    }
  });
});
