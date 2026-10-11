const MORK_TEKST = "#1b1f27";
const LYS_TEKST = "#ffffff";

/** Lysstyrken til en farge «#rrggbb» etter WCAG, fra 0 (svart) til 1 (hvit). */
function lysstyrke(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

const kontrast = (a: number, b: number) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);

/** Hvit eller mørk tekst, avhengig av hva som er lettest å lese på bakgrunnsfargen. */
export function lesbarTekstfarge(bakgrunn: string): string {
  if (!/^#[0-9a-fA-F]{6}$/.test(bakgrunn)) return MORK_TEKST;
  const l = lysstyrke(bakgrunn);
  return kontrast(l, lysstyrke(LYS_TEKST)) >= kontrast(l, lysstyrke(MORK_TEKST))
    ? LYS_TEKST
    : MORK_TEKST;
}
