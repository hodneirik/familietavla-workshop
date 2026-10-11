import { describe, expect, it, vi } from "vitest";
import { harNyVersjon, skriptFraHtml } from "./versjon";

const side = (skript: string) =>
  `<!doctype html><html><head><script type="module" crossorigin src="${skript}"></script></head><body></body></html>`;

const svar = (body: string, ok = true) => ({ ok, text: async () => body }) as unknown as Response;

describe("skriptFraHtml", () => {
  it("finner hovedskriptet", () => {
    expect(skriptFraHtml(side("/assets/index-abc123.js"))).toBe("/assets/index-abc123.js");
  });
  it("gir null for en side som ikke er appen", () => {
    expect(skriptFraHtml("<html><body>Logg inn</body></html>")).toBeNull();
  });
});

describe("harNyVersjon", () => {
  const lastet = "/assets/index-abc123.js";
  it("sier ja når serveren har et annet skript", async () => {
    const hent = vi.fn().mockResolvedValue(svar(side("/assets/index-NY999.js")));
    expect(await harNyVersjon(hent, lastet)).toBe(true);
    expect(hent).toHaveBeenCalledWith("/", expect.objectContaining({ cache: "no-store" }));
  });
  it("sier nei når det er samme versjon", async () => {
    const hent = vi.fn().mockResolvedValue(svar(side(lastet)));
    expect(await harNyVersjon(hent, lastet)).toBe(false);
  });
  it("sier nei når alt er usikkert: feil, nett borte eller en annen side", async () => {
    expect(await harNyVersjon(vi.fn().mockResolvedValue(svar("x", false)), lastet)).toBe(false);
    expect(await harNyVersjon(vi.fn().mockRejectedValue(new Error("offline")), lastet)).toBe(false);
    expect(
      await harNyVersjon(vi.fn().mockResolvedValue(svar("<html>Logg inn</html>")), lastet),
    ).toBe(false);
  });
  it("sjekker ikke i utvikling, der det ikke finnes et skript å sammenligne med", async () => {
    const hent = vi.fn();
    expect(await harNyVersjon(hent, null)).toBe(false);
    expect(hent).not.toHaveBeenCalled();
  });
});
