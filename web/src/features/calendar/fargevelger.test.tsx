import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Avkrysning } from "../../design/Felt";
import { Fargevelger } from "./Fargevelger";

describe("Fargevelger", () => {
  it("viser hake på den valgte fargen, og farger har navn", () => {
    const html = renderToStaticMarkup(<Fargevelger verdi="#889CB0" onChange={() => {}} />);
    expect(html.match(/aria-checked="true"/g)).toHaveLength(1);
    expect(html).toContain('aria-label="Skifer"');
    expect(html).toContain('aria-label="Grønn"');
    expect(html).not.toContain('#82b797"');
  });

  it("en egen farge får hake på den egne sirkelen i stedet for paletten", () => {
    const html = renderToStaticMarkup(<Fargevelger verdi="#123456" onChange={() => {}} />);
    expect(html).not.toContain('aria-checked="true"');
    expect(html).toContain("egenfarge valgt");
    expect(html).toContain("background:#123456");
  });
});

describe("Avkrysning", () => {
  it("er en vanlig avkrysningsboks med tegnet hake når den er valgt", () => {
    const av = renderToStaticMarkup(
      <Avkrysning etikett="Hele dagen" checked={false} onChange={() => {}} />,
    );
    const paa = renderToStaticMarkup(
      <Avkrysning etikett="Hele dagen" checked onChange={() => {}} />,
    );
    expect(av).toContain('type="checkbox"');
    expect(av).toContain("Hele dagen");
    expect(av).not.toContain("rute huket");
    expect(paa).toContain("rute huket");
    expect(paa).toContain("<svg");
  });
});
