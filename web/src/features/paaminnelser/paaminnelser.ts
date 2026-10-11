import { kortDato, kortUkedag, ukedagNr } from "../../lib/dato";
import type { Paaminnelse } from "../../lib/types";

export const UKEDAGER = ["Mandag", "Tirsdag", "Onsdag", "Torsdag", "Fredag", "Lørdag", "Søndag"];

type Tid = Pick<Paaminnelse, "ukedag" | "dato" | "fra" | "til">;

/** Gjelder påminnelsen på denne datoen? Enkeltdagen på sin dato, en fast ukedag på ukedagen (og i perioden, om en er satt). */
export function gjelderPaa(p: Tid, dato: string): boolean {
  if (p.dato !== null) return p.dato === dato;
  if (p.ukedag !== ukedagNr(dato)) return false;
  return (!p.fra || dato >= p.fra) && (!p.til || dato <= p.til);
}

/** Påminnelsene som gjelder en dato, sortert etter tittel og barn. */
export function paaminnelserForDag(alle: Paaminnelse[], dato: string): Paaminnelse[] {
  return alle
    .filter((p) => gjelderPaa(p, dato))
    .sort(
      (a, b) =>
        a.tittel.localeCompare(b.tittel, "nb") ||
        a.barn.visningsnavn.localeCompare(b.barn.visningsnavn, "nb") ||
        a.id - b.id,
    );
}

/** Hvor lenge en fast påminnelse gjelder, i ord. Tom hvis den gjelder hele tiden. */
export function periodetekst(p: Pick<Paaminnelse, "fra" | "til">): string {
  if (p.fra && p.til) return `${kortDato(p.fra)} til ${kortDato(p.til)}`;
  if (p.fra) return `fra ${kortDato(p.fra)}`;
  if (p.til) return `til ${kortDato(p.til)}`;
  return "";
}

/** Enkeltdagen skrevet ut, for eksempel «Fre 16. okt.». */
export const enkeltdagTekst = (dato: string): string => `${kortUkedag(dato)} ${kortDato(dato)}`;

export interface PaaminnelseGruppe {
  tittel: string;
  /** Hvem den gjelder. Tom når barnet selv ser den. */
  barn: string[];
}

/**
 * Slår sammen like titler, så «Gym» til både Elias og Nelly blir én linje: «Gym · Elias, Nelly».
 * Med `medBarn` false (barnets egen visning) utelates navnene.
 */
export function grupperPaaminnelser(liste: Paaminnelse[], medBarn: boolean): PaaminnelseGruppe[] {
  const grupper = new Map<string, PaaminnelseGruppe>();
  for (const p of liste) {
    const nokkel = p.tittel.toLocaleLowerCase("nb");
    const g = grupper.get(nokkel) ?? { tittel: p.tittel, barn: [] };
    if (medBarn && !g.barn.includes(p.barn.visningsnavn)) g.barn.push(p.barn.visningsnavn);
    grupper.set(nokkel, g);
  }
  return [...grupper.values()];
}
