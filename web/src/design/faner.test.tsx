import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Faner } from "./Faner";

const valg = [
  { id: "a", navn: "Min profil" },
  { id: "b", navn: "Familie" },
];
const vis = (aktiv: string) =>
  renderToStaticMarkup(
    <Faner valg={valg} aktiv={aktiv} onVelg={() => {}} etikett="Innstillinger">
      <p>Innhold</p>
    </Faner>,
  );

describe("Faner", () => {
  it("er en tablist med én valgt fane og et panel koblet til den", () => {
    const html = vis("b");
    expect(html).toContain('role="tablist"');
    expect(html).toContain('aria-label="Innstillinger"');
    expect(html.match(/aria-selected="true"/g)).toHaveLength(1);
    expect(html).toMatch(/role="tab"[^>]*aria-selected="true"[^>]*>Familie</);
    expect(html).toContain('role="tabpanel"');
    expect(html).toContain("Innhold");
  });

  it("bare den valgte fanen kan nås med Tab", () => {
    const html = vis("a");
    expect(html.match(/tabindex="0"/g)).toHaveLength(1);
    expect(html.match(/tabindex="-1"/g)).toHaveLength(1);
  });
});
