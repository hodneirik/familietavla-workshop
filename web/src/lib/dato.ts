/**
 * Datoer som tekst: dato «ÅÅÅÅ-MM-DD» og tidspunkt «ÅÅÅÅ-MM-DDTHH:MM», i norsk lokal tid.
 * Regnes i UTC bare for å slippe at sommertid flytter en dag.
 */
export type Dato = string;

const del = (dato: Dato) => dato.split("-").map(Number) as [number, number, number];
const tilDato = (ms: number): Dato => new Date(ms).toISOString().slice(0, 10);
const tilMs = (dato: Dato) => {
  const [y, m, d] = del(dato);
  return Date.UTC(y, m - 1, d);
};

const osloFormat = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Europe/Oslo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Dagens dato i Norge, uansett hvilken tidssone enheten står i. */
export function iDag(naa: Date = new Date()): Dato {
  return osloFormat.format(naa);
}

export const leggTilDager = (dato: Dato, antall: number): Dato =>
  tilDato(tilMs(dato) + antall * 86_400_000);

export const dagerMellom = (fra: Dato, til: Dato): number =>
  Math.round((tilMs(til) - tilMs(fra)) / 86_400_000);

/** 0 for mandag og 6 for søndag. */
export function ukedagNr(dato: Dato): number {
  return (new Date(tilMs(dato)).getUTCDay() + 6) % 7;
}

export const mandagFor = (dato: Dato): Dato => leggTilDager(dato, -ukedagNr(dato));

/** ISO-uketall: uke 1 er uka med årets første torsdag. */
export function ukenr(dato: Dato): number {
  const torsdag = leggTilDager(mandagFor(dato), 3);
  const aarStart = `${torsdag.slice(0, 4)}-01-01`;
  return Math.floor(dagerMellom(aarStart, torsdag) / 7) + 1;
}

export const maanedStart = (dato: Dato): Dato => `${dato.slice(0, 7)}-01`;

export function leggTilManeder(dato: Dato, antall: number): Dato {
  const [y, m] = del(dato);
  return tilDato(Date.UTC(y, m - 1 + antall, 1));
}

/** Alle dagene som vises i en månedsvisning: hele uker fra mandag til søndag. */
export function rutenett(dato: Dato): Dato[] {
  const forste = maanedStart(dato);
  const start = mandagFor(forste);
  const sisteIMaaned = leggTilDager(leggTilManeder(forste, 1), -1);
  const slutt = leggTilDager(mandagFor(sisteIMaaned), 7);
  return Array.from({ length: dagerMellom(start, slutt) }, (_, i) => leggTilDager(start, i));
}

export const dagFra = (tidspunkt: string): Dato => tidspunkt.slice(0, 10);
export const klokkeslett = (tidspunkt: string): string => tidspunkt.slice(11, 16);

/** Legger minutter til et klokkeslett «HH:MM», uten å gå forbi 23:59. */
export function leggTilMinutterTid(tid: string, minutter: number): string {
  const [t, m] = tid.split(":").map(Number) as [number, number];
  const sum = Math.min(t * 60 + m + minutter, 23 * 60 + 59);
  return `${String(Math.floor(sum / 60)).padStart(2, "0")}:${String(sum % 60).padStart(2, "0")}`;
}

const format = (dato: Dato, opts: Intl.DateTimeFormatOptions) =>
  new Date(`${dato}T12:00:00Z`).toLocaleDateString("nb-NO", { timeZone: "UTC", ...opts });

/** Første bokstav stor, resten som den er («tirsdag 6. oktober» blir «Tirsdag 6. oktober»). */
export const stor = (tekst: string): string => tekst.charAt(0).toUpperCase() + tekst.slice(1);

export const maanedOgAar = (dato: Dato) => stor(format(dato, { month: "long", year: "numeric" }));
export const langDato = (dato: Dato) =>
  stor(format(dato, { weekday: "long", day: "numeric", month: "long" }));
export const kortDato = (dato: Dato) => format(dato, { day: "numeric", month: "short" });
export const kortUkedag = (dato: Dato) => stor(format(dato, { weekday: "short" }).replace(".", ""));
/** «6. oktober 2026» */
export const datoMedAar = (dato: Dato) =>
  format(dato, { day: "numeric", month: "long", year: "numeric" });
export const ukedagNavn = ["man", "tir", "ons", "tor", "fre", "lør", "søn"];
