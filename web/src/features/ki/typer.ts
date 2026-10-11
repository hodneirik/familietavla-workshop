import type { Lappfarge } from "../../lib/types";

/** Det serveren svarer med. Speiler server/src/modules/ki. */

export type KiGrunn = "avskrudd" | "mangler_nokkel" | "tak_naadd";

export interface KiStatusSvar {
  aktiv: boolean;
  grunn?: KiGrunn;
  modell: string;
  brukt_ore: number;
  tak_ore: number;
  antall: number;
}

export interface KiInnstillingerSvar {
  /** Voksne som spiser middag. Barna telles fra familien. */
  voksne: number;
  /** Faste regler for middag, adskilt fra reglene for ukeplanen. */
  middagRegler: string;
  barn: { id: number; navn: string; klasse: string | null }[];
  regler: string;
  standardKalenderId: number | null;
  kalendere: { id: number; navn: string }[];
}

export interface LeksForslag {
  forslagId: string;
  barnIder: number[];
  barnNavn: string[];
  fag: string | null;
  tittel: string;
  fritekst: string | null;
  frist: string;
  usikker: boolean;
}

export interface AvtaleForslag {
  forslagId: string;
  kalenderId: number | null;
  tittel: string;
  sted: string | null;
  helDag: boolean;
  start: string;
  slutt: string | null;
  gjentasUkentlig: boolean;
  barnNavn: string[];
  usikker: boolean;
}

export interface PaaminnelseForslag {
  forslagId: string;
  barnIder: number[];
  barnNavn: string[];
  tittel: string;
  /** 0 = mandag, 6 = søndag. Tom for en enkeltdag. */
  ukedag: number | null;
  /** Enkeltdagen (ÅÅÅÅ-MM-DD). Tom for en fast ukedag. */
  dato: string | null;
  fra: string | null;
  til: string | null;
  usikker: boolean;
}

export interface LappForslag {
  forslagId: string;
  tekst: string;
  farge: Lappfarge;
}

export interface AnnetForslag {
  tittel: string;
  tekst: string;
}

export interface Sporsmaal {
  id: string;
  tekst: string;
  valg: { id: string; tekst: string }[];
}

export interface ValidertForslag {
  ukeStart: string;
  sammendrag: string;
  lekser: LeksForslag[];
  avtaler: AvtaleForslag[];
  paaminnelser: PaaminnelseForslag[];
  lapper: LappForslag[];
  annet: AnnetForslag[];
  spoersmaal: Sporsmaal[];
  advarsler: string[];
  forkastet: number;
}

export interface AnalyseResultat {
  forslag: ValidertForslag;
  kontrollsum: string;
  kostnad_ore: number;
  brukt_ore: number;
  tak_ore: number;
}

export type JobbSvar =
  | { status: "venter" }
  | { status: "feil"; melding: string }
  | { status: "ferdig"; resultat: AnalyseResultat };

export interface Duplikat {
  innlagt: string;
  av: string | null;
}

export interface SvarRad {
  spoersmaalId: string;
  spoersmaal: string;
  svar: string;
}

export interface RadResultat {
  forslagId: string;
  type: "lekse" | "avtale" | "paaminnelse" | "lapp";
  ok: boolean;
  feil?: string;
}

export interface LeggInnSvar {
  rader: RadResultat[];
  antallOk: number;
}
