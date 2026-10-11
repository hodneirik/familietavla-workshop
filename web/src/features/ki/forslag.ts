import { ukedagNr, leggTilDager, mandagFor, ukenr } from "../../lib/dato";
import type { Lappfarge } from "../../lib/types";
import type { AnalyseResultat, Sporsmaal, SvarRad, ValidertForslag } from "./typer";

/** Mandagen i uka planen sannsynligvis gjelder: neste uke fra fredag, ellers denne uka. */
export function standardUke(idag: string): string {
  return ukedagNr(idag) >= 4 ? leggTilDager(mandagFor(idag), 7) : mandagFor(idag);
}

/** Uker forelderen kan velge mellom: forrige, denne og de to neste. */
export function ukevalg(idag: string): string[] {
  const denne = mandagFor(idag);
  return [-7, 0, 7, 14].map((d) => leggTilDager(denne, d));
}

const tosiffer = (n: number) => String(n).padStart(2, "0");

/** «Uke 41: 05.10 - 11.10». Uke først og datoene etter, fra mandag til søndag. */
export function ukeEtikett(mandag: string): string {
  const [, mnd, dag] = mandag.split("-").map(Number);
  const slutt = leggTilDager(mandag, 6).split("-").map(Number);
  return `Uke ${ukenr(mandag)}: ${tosiffer(dag!)}.${tosiffer(mnd!)} - ${tosiffer(slutt[2]!)}.${tosiffer(slutt[1]!)}`;
}

/** PDF-en som base64, bit for bit så store filer ikke sprenger stakken. */
export function base64FraBytes(bytes: Uint8Array): string {
  let ut = "";
  const bit = 0x8000;
  for (let i = 0; i < bytes.length; i += bit) {
    ut += String.fromCharCode(...bytes.subarray(i, i + bit));
  }
  return btoa(ut);
}

export const kroner = (ore: number): string =>
  `${(ore / 100).toLocaleString("nb-NO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kr`;

export const SKIP = "Hopp over";

/** Spørsmålene med svarene forelderen har gitt, klare til å sendes i neste runde. */
export function lagSvarListe(sporsmaal: Sporsmaal[], valgt: Record<string, string>): SvarRad[] {
  return sporsmaal
    .filter((s) => valgt[s.id] !== undefined)
    .map((s) => ({ spoersmaalId: s.id, spoersmaal: s.tekst, svar: valgt[s.id]! }));
}

/** Tidligere svar beholdes, og et nytt svar på samme spørsmål erstatter det gamle. */
export function slaaSammenSvar(gamle: SvarRad[], nye: SvarRad[]): SvarRad[] {
  const ider = new Set(nye.map((s) => s.spoersmaalId));
  return [...gamle.filter((s) => !ider.has(s.spoersmaalId)), ...nye];
}

// Forslagene forelderen redigerer

export interface LeksRedigert {
  forslagId: string;
  valgt: boolean;
  barnIder: number[];
  barnNavn: string[];
  fag: string;
  tittel: string;
  fritekst: string;
  frist: string;
  usikker: boolean;
}

export interface AvtaleRedigert {
  forslagId: string;
  valgt: boolean;
  kalenderId: number | null;
  tittel: string;
  sted: string;
  dato: string;
  /** Tom for hel dag. */
  fra: string;
  til: string;
  gjentas: boolean;
  gjentasTil: string;
  barnNavn: string[];
  usikker: boolean;
}

export interface PaaminnelseRedigert {
  forslagId: string;
  valgt: boolean;
  barnIder: number[];
  barnNavn: string[];
  tittel: string;
  /** «fast» gjentas hver uke (eventuelt bare i en periode), «dag» gjelder én dato. */
  slag: "fast" | "dag";
  ukedag: number;
  dato: string;
  /** Periode for en fast ukedag. Tom hvis den gjelder hele tiden. */
  fra: string;
  til: string;
  usikker: boolean;
}

export interface LappRedigert {
  forslagId: string;
  valgt: boolean;
  tekst: string;
  farge: Lappfarge;
}

export interface ForslagState {
  lekser: LeksRedigert[];
  avtaler: AvtaleRedigert[];
  paaminnelser: PaaminnelseRedigert[];
  lapper: LappRedigert[];
  annet: ValidertForslag["annet"];
}

export function lagForslagState(r: AnalyseResultat): ForslagState {
  const f = r.forslag;
  return {
    lekser: f.lekser.map((l) => ({
      forslagId: l.forslagId,
      valgt: !l.usikker,
      barnIder: l.barnIder,
      barnNavn: l.barnNavn,
      fag: l.fag ?? "",
      tittel: l.tittel,
      fritekst: l.fritekst ?? "",
      frist: l.frist,
      usikker: l.usikker,
    })),
    avtaler: f.avtaler.map((a) => ({
      forslagId: a.forslagId,
      valgt: !a.usikker && a.kalenderId !== null,
      kalenderId: a.kalenderId,
      tittel: a.tittel,
      sted: a.sted ?? "",
      dato: a.start.slice(0, 10),
      fra: a.helDag ? "" : a.start.slice(11, 16),
      til: a.helDag || !a.slutt ? "" : a.slutt.slice(11, 16),
      gjentas: a.gjentasUkentlig,
      gjentasTil: leggTilDager(a.start.slice(0, 10), 28),
      barnNavn: a.barnNavn,
      usikker: a.usikker,
    })),
    paaminnelser: f.paaminnelser.map((p) => ({
      forslagId: p.forslagId,
      valgt: !p.usikker,
      barnIder: p.barnIder,
      barnNavn: p.barnNavn,
      tittel: p.tittel,
      slag: p.dato ? ("dag" as const) : ("fast" as const),
      ukedag: p.ukedag ?? 0,
      dato: p.dato ?? "",
      fra: p.fra ?? "",
      til: p.til ?? "",
      usikker: p.usikker,
    })),
    lapper: f.lapper.map((l) => ({
      forslagId: l.forslagId,
      valgt: true,
      tekst: l.tekst,
      farge: l.farge,
    })),
    annet: f.annet,
  };
}

export type Gruppe = "lekser" | "avtaler" | "paaminnelser" | "lapper";

export type ForslagHandling =
  | { type: "veksle"; gruppe: Gruppe; forslagId: string }
  | {
      type: "endre";
      gruppe: Gruppe;
      forslagId: string;
      felt: string;
      verdi: string | boolean | number | null;
    }
  | { type: "velgAlle"; gruppe: Gruppe; valgt: boolean }
  | { type: "annetTilLapp"; indeks: number }
  | { type: "sett"; state: ForslagState };

const MAKS_LAPP = 280;

export function forslagReducer(state: ForslagState, h: ForslagHandling): ForslagState {
  switch (h.type) {
    case "sett":
      return h.state;
    case "veksle":
      return {
        ...state,
        [h.gruppe]: state[h.gruppe].map((x) =>
          x.forslagId === h.forslagId ? { ...x, valgt: !x.valgt } : x,
        ),
      };
    case "velgAlle":
      return { ...state, [h.gruppe]: state[h.gruppe].map((x) => ({ ...x, valgt: h.valgt })) };
    case "endre":
      return {
        ...state,
        [h.gruppe]: state[h.gruppe].map((x) =>
          x.forslagId === h.forslagId ? { ...x, [h.felt]: h.verdi } : x,
        ),
      };
    case "annetTilLapp": {
      const a = state.annet[h.indeks];
      if (!a) return state;
      const tekst = `${a.tittel}: ${a.tekst}`.slice(0, MAKS_LAPP);
      const nummer = state.lapper.length + 1;
      return {
        ...state,
        annet: state.annet.filter((_, i) => i !== h.indeks),
        lapper: [
          ...state.lapper,
          { forslagId: `p${nummer}-fra-annet`, valgt: true, tekst, farge: "gul" },
        ],
      };
    }
  }
}

export const antallValgt = (s: ForslagState): number =>
  [...s.lekser, ...s.avtaler, ...s.paaminnelser, ...s.lapper].filter((x) => x.valgt).length;

/** Hva som mangler før forslagene kan legges inn. Tom liste betyr at alt er klart. */
export function mangler(s: ForslagState): string[] {
  const feil: string[] = [];
  if (antallValgt(s) === 0) feil.push("Velg minst ett forslag.");
  for (const l of s.lekser.filter((x) => x.valgt)) {
    if (!l.tittel.trim() || !l.frist)
      feil.push(`Leksa «${l.tittel || "uten tittel"}» mangler tittel eller frist.`);
  }
  for (const a of s.avtaler.filter((x) => x.valgt)) {
    if (!a.tittel.trim() || !a.dato)
      feil.push(`Avtalen «${a.tittel || "uten tittel"}» mangler tittel eller dato.`);
    else if (a.kalenderId === null) feil.push(`Velg kalender for «${a.tittel}».`);
    else if (a.til && !a.fra) feil.push(`«${a.tittel}» har sluttid, men ikke starttid.`);
    else if (a.gjentas && !a.gjentasTil) feil.push(`Velg siste dag «${a.tittel}» gjentas.`);
  }
  for (const p of s.paaminnelser.filter((x) => x.valgt)) {
    if (!p.tittel.trim()) feil.push("En påminnelse mangler tittel.");
    else if (p.slag === "dag" && !p.dato) feil.push(`Velg dato for «${p.tittel}».`);
    else if (p.slag === "fast" && p.fra && p.til && p.til < p.fra)
      feil.push(`Perioden for «${p.tittel}» slutter før den begynner.`);
  }
  for (const l of s.lapper.filter((x) => x.valgt)) {
    if (!l.tekst.trim()) feil.push("En lapp er tom.");
  }
  return feil;
}

export function lagLeggInnBody(s: ForslagState, ukeStart: string, kontrollsum: string) {
  return {
    ukeStart,
    kontrollsum,
    lekser: s.lekser
      .filter((l) => l.valgt)
      .map((l) => ({
        forslagId: l.forslagId,
        barnIder: l.barnIder,
        tittel: l.tittel.trim(),
        fag: l.fag.trim() || null,
        fritekst: l.fritekst.trim() || null,
        frist: l.frist,
      })),
    avtaler: s.avtaler
      .filter((a) => a.valgt && a.kalenderId !== null)
      .map((a) => {
        const helDag = !a.fra;
        return {
          forslagId: a.forslagId,
          kalenderId: a.kalenderId!,
          tittel: a.tittel.trim(),
          sted: a.sted.trim() || null,
          helDag,
          start: helDag ? a.dato : `${a.dato}T${a.fra}`,
          slutt: !helDag && a.til ? `${a.dato}T${a.til}` : null,
          gjentas: a.gjentas ? ("ukentlig" as const) : null,
          gjentasTil: a.gjentas ? a.gjentasTil : null,
        };
      }),
    paaminnelser: s.paaminnelser
      .filter((p) => p.valgt)
      .map((p) => ({
        forslagId: p.forslagId,
        barnIder: p.barnIder,
        tittel: p.tittel.trim(),
        ukedag: p.slag === "fast" ? p.ukedag : null,
        dato: p.slag === "dag" ? p.dato : null,
        fra: p.slag === "fast" ? p.fra || null : null,
        til: p.slag === "fast" ? p.til || null : null,
      })),
    lapper: s.lapper
      .filter((l) => l.valgt)
      .map((l) => ({ forslagId: l.forslagId, tekst: l.tekst.trim(), farge: l.farge })),
  };
}
