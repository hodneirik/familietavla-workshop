/** Besteforeldre ser, og kan bare legge til og godkjenne egne gjøremål. */
export type Rolle = "forelder" | "barn" | "besteforelder";

export interface Bruker {
  id: number;
  visningsnavn: string;
  rolle: Rolle;
  farge: string;
  emoji: string | null;
}

export interface BrukerAdmin extends Bruker {
  aktiv: number;
}

export const LAPPFARGER = ["gul", "rosa", "blå", "grønn", "oransje"] as const;
export type Lappfarge = (typeof LAPPFARGER)[number];

export interface Lapp {
  id: number;
  tekst: string;
  farge: Lappfarge;
  opprettet: string;
  endret: string | null;
  forfatter: { id: number; visningsnavn: string; farge: string; emoji: string | null };
  kanEndre: boolean;
}

export type Status = "ledig" | "tatt" | "venter" | "godkjent";

export type Gjentakelse = "daglig" | "ukentlig" | "annenhver_uke" | "maanedlig";

export interface Oppgave {
  id: number;
  tittel: string;
  poeng: number;
  /** Hvor ofte gjøremålet kommer tilbake etter at det er godkjent. Null hvis det bare gjøres én gang. */
  gjentas: Gjentakelse | null;
  /** Et gjøremål som hviler, kan tas først fra og med denne datoen. */
  ledigFra: string | null;
  /** Hvem som laget gjøremålet. Besteforeldre kan bare endre og godkjenne sine egne. */
  opprettetAv: number | null;
  status: Status;
  opprettet: string;
  tatt: string | null;
  fullfort: string | null;
  godkjent: string | null;
  eier: Bruker | null;
}

export interface Poengstatus {
  bruker: Bruker;
  poeng: number;
  klare: number;
}

export interface Vaerdag {
  dato: string;
  tempMin: number | null;
  tempMaks: number | null;
  nedbor: number;
  vindMaks: number | null;
  symbol: string | null;
}

export interface Vaervarsel {
  sted: string;
  hentet: string;
  foreldet: boolean;
  dager: Vaerdag[];
}

export interface Kalender {
  id: number;
  navn: string;
  farge: string;
  kilde: string;
}

export interface Hendelse {
  id: number;
  kalenderId: number;
  tittel: string;
  start: string;
  slutt: string;
  helDag: boolean;
  sted: string | null;
  kilde: string;
  /** Satt for en avtale som gjentas hver uke. */
  gjentas: "ukentlig" | null;
  /** Siste dag avtalen gjentas, ellers null. */
  gjentasTil: string | null;
  /** Start og slutt for første gang avtalen skjedde. Brukes når serien endres. */
  startOriginal: string;
  sluttOriginal: string;
}

export interface Vare {
  id: number;
  navn: string;
  /** Notatet som vises i grå skrift, også når varen må handles innen for en middag. */
  notat: string | null;
  /** Bare det man selv har skrevet, og det som kan endres. */
  egetNotat: string | null;
  /** Hvor mye middagene trenger til sammen, for eksempel «600 g» eller «2 stk + 1 pk». Tom uten mengder. */
  mengde: string | null;
  kjopt: boolean;
  opprettet: string;
  kjoptTid: string | null;
  lagtTilAv: Bruker | null;
}

export interface Middag {
  dato: string;
  rettId: number | null;
  rett: string;
  notat: string | null;
  minStjerner: number | null;
}

/** En fast middagsrett. Barn får ikke notat og ingredienser. */
export interface Rett {
  id: number;
  tittel: string;
  notat?: string | null;
  ingredienser?: string[];
  snitt: number | null;
  antall: number;
  minSnitt: number | null;
  minAntall: number;
}

export interface Paaminnelse {
  id: number;
  barn: { id: number; visningsnavn: string; farge: string; emoji: string | null };
  tittel: string;
  /** 0 = mandag, 6 = søndag. Tom for en enkeltdag. */
  ukedag: number | null;
  /** Enkeltdagen (ÅÅÅÅ-MM-DD), for eksempel en turdag. Tom for en fast ukedag. */
  dato: string | null;
  /** Første og siste dag for en fast ukedag som bare gjelder en periode. */
  fra: string | null;
  til: string | null;
}

export interface Lekse {
  id: number;
  barn: { id: number; visningsnavn: string; farge: string; emoji: string | null };
  fag: string | null;
  tittel: string;
  /** Mer om hva som skal gjøres, fritt formulert. */
  fritekst: string | null;
  /** Dagen leksa skal være gjort (ÅÅÅÅ-MM-DD). */
  frist: string;
  gjort: boolean;
}
