import { leggTilDager, mandagFor } from "../../lib/dato";

/** Det serveren svarer med når KI-en foreslår middag. Speiler server/src/modules/ki/middag.ts. */
export interface MiddagDagForslag {
  forslagId: string;
  dato: string;
  rettId: number | null;
  tittel: string;
  snitt: number | null;
  ny: boolean;
  ingredienser: string[];
  /** Ingredienser dagen bruker opp fra en annen dag. */
  gjenbruk: string[];
  begrunnelse: string;
}

export interface MiddagForslagSvar {
  fra: string;
  til: string;
  sammendrag: string;
  dager: MiddagDagForslag[];
  advarsler: string[];
  forkastet: number;
}

export interface MiddagResultat {
  forslag: MiddagForslagSvar;
  kostnad_ore: number;
  brukt_ore: number;
  tak_ore: number;
}

export interface MiddagLeggInnSvar {
  rader: { forslagId: string; dato: string; ok: boolean; feil?: string }[];
  antallOk: number;
  nyeRetter: number;
}

export type Tidsrom = "resten" | "neste" | "sju";

export const TIDSROM: { id: Tidsrom; navn: string }[] = [
  { id: "resten", navn: "Resten av denne uka" },
  { id: "neste", navn: "Hele neste uke" },
  { id: "sju", navn: "De neste sju dagene" },
];

/** Fra og til (begge med) for et tidsrom regnet fra i dag. */
export function tidsromDatoer(idag: string, valg: Tidsrom): { fra: string; til: string } {
  const denneMandag = mandagFor(idag);
  switch (valg) {
    case "resten":
      return { fra: idag, til: leggTilDager(denneMandag, 6) };
    case "neste":
      return { fra: leggTilDager(denneMandag, 7), til: leggTilDager(denneMandag, 13) };
    case "sju":
      return { fra: idag, til: leggTilDager(idag, 6) };
  }
}

/** Hva forelderen kan endre i et forslag: velge bort dagen, eller bytte rett. */
export interface MiddagDagRedigert {
  forslagId: string;
  dato: string;
  valgt: boolean;
  /** Tallet er en rett som finnes, «ny» er retten KI-en foreslo. */
  rett: number | "ny";
  ny: { tittel: string; ingredienser: string[] } | null;
  begrunnelse: string;
  gjenbruk: string[];
  snitt: number | null;
  tittel: string;
}

export function lagMiddagState(f: MiddagForslagSvar): MiddagDagRedigert[] {
  return f.dager.map((d) => ({
    forslagId: d.forslagId,
    dato: d.dato,
    valgt: true,
    rett: d.ny || d.rettId === null ? "ny" : d.rettId,
    ny: d.ny ? { tittel: d.tittel, ingredienser: d.ingredienser } : null,
    begrunnelse: d.begrunnelse,
    gjenbruk: d.gjenbruk,
    snitt: d.snitt,
    tittel: d.tittel,
  }));
}

/** Teksten under «Legg inn», slik at forelderen ser hva som skjer. */
export const antallValgt = (dager: MiddagDagRedigert[]) => dager.filter((d) => d.valgt).length;

export function lagMiddagBody(dager: MiddagDagRedigert[], paaHandleliste: boolean) {
  return {
    paaHandleliste,
    dager: dager
      .filter((d) => d.valgt)
      .map((d) =>
        d.rett === "ny" && d.ny
          ? { forslagId: d.forslagId, dato: d.dato, ny: d.ny }
          : { forslagId: d.forslagId, dato: d.dato, rettId: d.rett === "ny" ? null : d.rett },
      ),
  };
}

/** En dag er klar hvis den har en rett: enten en som finnes, eller en ny med navn. */
export const erKlar = (d: MiddagDagRedigert): boolean =>
  d.rett !== "ny" || (d.ny !== null && d.ny.tittel.trim() !== "");
