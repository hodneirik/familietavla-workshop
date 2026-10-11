import { dagFra, kortDato, klokkeslett, leggTilDager, mandagFor } from "../../lib/dato";
import type { Hendelse } from "../../lib/types";

/** Avtaler som overlapper dagen. Tidene er lokal tid som tekst, så vanlig tekstsammenligning holder. */
export const paaDag = (h: Hendelse, dato: string): boolean =>
  h.start < `${leggTilDager(dato, 1)}T00:00` && h.slutt > `${dato}T00:00`;

export function tidTekst(h: Hendelse): string {
  const sisteDag = leggTilDager(dagFra(h.slutt), h.helDag ? -1 : 0);
  if (h.helDag) {
    return sisteDag === dagFra(h.start)
      ? "Hele dagen"
      : `${kortDato(dagFra(h.start))} til ${kortDato(sisteDag)}`;
  }
  if (dagFra(h.start) === dagFra(h.slutt))
    return `${klokkeslett(h.start)} til ${klokkeslett(h.slutt)}`;
  return `${klokkeslett(h.start)} til ${kortDato(dagFra(h.slutt))} ${klokkeslett(h.slutt)}`;
}

/** Datoene fra og med i dag til og med nærmeste søndag. På en søndag er det bare den ene dagen. */
export function dagerTilSondag(idag: string): string[] {
  const sondag = leggTilDager(mandagFor(idag), 6);
  const dager: string[] = [];
  for (let d = idag; d <= sondag; d = leggTilDager(d, 1)) dager.push(d);
  return dager;
}
