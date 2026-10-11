/**
 * Datoer og klokkeslett som tekst i norsk lokal tid, uten tidssone:
 * dato «ÅÅÅÅ-MM-DD» og tidspunkt «ÅÅÅÅ-MM-DDTHH:MM». Regnes i UTC bare for å slippe sommertid-trøbbel.
 */
const DATO = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIDSPUNKT = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})$/;

export function erDato(s: string): boolean {
  const m = DATO.exec(s);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (y < 2000 || y > 2100) return false;
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d;
}

export function erTidspunkt(s: string): boolean {
  const m = TIDSPUNKT.exec(s);
  return !!m && erDato(m[1]!) && Number(m[2]) < 24 && Number(m[3]) < 60;
}

export function leggTilDager(dato: string, antall: number): string {
  const [y, m, d] = dato.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d + antall)).toISOString().slice(0, 10);
}

export function leggTilMinutter(tidspunkt: string, minutter: number): string {
  const [dato, tid] = tidspunkt.split("T") as [string, string];
  const [y, mo, d] = dato.split("-").map(Number) as [number, number, number];
  const [t, min] = tid.split(":").map(Number) as [number, number];
  return new Date(Date.UTC(y, mo - 1, d, t, min + minutter)).toISOString().slice(0, 16);
}

export function dagerMellom(fra: string, til: string): number {
  const ms = (s: string) => {
    const [y, m, d] = s.split("-").map(Number) as [number, number, number];
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((ms(til) - ms(fra)) / 86_400_000);
}

/** ISO-uketall: uke 1 er uka med årets første torsdag. */
export function ukenr(dato: string): number {
  const [y, m, d] = dato.split("-").map(Number) as [number, number, number];
  const ms = Date.UTC(y, m - 1, d);
  const ukedag = (new Date(ms).getUTCDay() + 6) % 7; // 0 = mandag
  const torsdag = new Date(ms + (3 - ukedag) * 86_400_000);
  const aarStart = Date.UTC(torsdag.getUTCFullYear(), 0, 1);
  return Math.floor((torsdag.getTime() - aarStart) / 86_400_000 / 7) + 1;
}

const norskFormat = new Intl.DateTimeFormat("nb-NO", {
  weekday: "long",
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

/** «fredag 9. okt.» */
export function norskDato(dato: string): string {
  return norskFormat.format(new Date(`${dato}T12:00:00Z`));
}

const osloFormat = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Europe/Oslo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Dato i Norge for et tidspunkt (millisekunder), uansett hvilken tidssone serveren står i. */
export function osloDato(ms: number): string {
  return osloFormat.format(ms);
}

/** Mandagen i uka datoen ligger i. */
export function mandagFor(dato: string): string {
  const [y, m, d] = dato.split("-").map(Number) as [number, number, number];
  const ukedag = (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7; // 0 = mandag
  return leggTilDager(dato, -ukedag);
}

/** Den første dagen i måneden etter den datoen ligger i. */
export function nesteMaanedStart(dato: string): string {
  const [y, m] = dato.split("-").map(Number) as [number, number];
  return new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10);
}

/** Flytter et tidspunkt («ÅÅÅÅ-MM-DDTHH:MM») eller en dato et antall dager. Klokkeslettet beholdes. */
export function flyttDager(tid: string, antall: number): string {
  const [dato, klokke] = tid.split("T") as [string, string | undefined];
  const ny = leggTilDager(dato, antall);
  return klokke === undefined ? ny : `${ny}T${klokke}`;
}
