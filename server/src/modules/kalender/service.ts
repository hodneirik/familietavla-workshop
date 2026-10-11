import { audit } from "../../core/audit.js";
import type { AuthUser } from "../../core/auth.js";
import {
  dagerMellom,
  erDato,
  erTidspunkt,
  flyttDager,
  leggTilDager,
  leggTilMinutter,
} from "../../core/dato.js";
import { HttpError } from "../../core/errors.js";
import type { Db } from "../../db/client.js";

const MAKS_DAGER = 400;
const MAKS_HENDELSER = 1000;
/** Lengste tid en ukentlig avtale kan gjentas, regnet fra første dag. */
const MAKS_GJENTAKELSE_DAGER = 730;

export interface Kalender {
  id: number;
  navn: string;
  farge: string;
  /** «manuell» nå. Senere f.eks. «spond», og da styres kalenderen utenfra. */
  kilde: string;
}

export interface Hendelse {
  id: number;
  kalenderId: number;
  tittel: string;
  /** Lokal klokketid, ÅÅÅÅ-MM-DDTHH:MM. */
  start: string;
  /** Slutt (ikke inkludert). For hel dag er det midnatt etter siste dag. */
  slutt: string;
  helDag: boolean;
  sted: string | null;
  kilde: string;
  /** «ukentlig» hvis avtalen gjentas hver uke, ellers null. */
  gjentas: "ukentlig" | null;
  /** Siste dag avtalen gjentas (ÅÅÅÅ-MM-DD), inkludert. */
  gjentasTil: string | null;
  /** Start og slutt for den første forekomsten. Start og slutt over er for denne forekomsten. */
  startOriginal: string;
  sluttOriginal: string;
}

export interface HendelseInn {
  kalenderId: number;
  tittel: string;
  sted?: string | null;
  helDag: boolean;
  /** Dato (ÅÅÅÅ-MM-DD) for hel dag, ellers klokketid (ÅÅÅÅ-MM-DDTHH:MM). */
  start: string;
  /** Siste dag (inkludert) for hel dag, ellers sluttid. Utelates for én dag eller én time. */
  slutt?: string | null;
  /** «ukentlig» for en avtale som gjentas hver uke fram til «gjentasTil». */
  gjentas?: "ukentlig" | null;
  gjentasTil?: string | null;
}

function kreverForelder(bruker: AuthUser): void {
  if (bruker.rolle !== "forelder") throw new HttpError(403, "Bare voksne kan endre kalenderen");
}

// Kalendere

const KAL = "SELECT id, navn, farge, kilde FROM kalendere";

export function listKalendere(db: Db): Kalender[] {
  return db.prepare(`${KAL} ORDER BY id`).all() as unknown as Kalender[];
}

function hentKalender(db: Db, id: number): Kalender {
  const k = db.prepare(`${KAL} WHERE id = ?`).get(id) as Kalender | undefined;
  if (!k) throw new HttpError(404, "Fant ikke kalenderen");
  return k;
}

export function createKalender(
  db: Db,
  bruker: AuthUser,
  data: { navn: string; farge: string },
): Kalender {
  kreverForelder(bruker);
  const res = db
    .prepare("INSERT INTO kalendere (navn, farge) VALUES (?, ?)")
    .run(data.navn, data.farge);
  const id = Number(res.lastInsertRowid);
  audit(db, bruker.id, "kalender_opprettet", { id });
  return hentKalender(db, id);
}

export function updateKalender(
  db: Db,
  bruker: AuthUser,
  id: number,
  data: { navn?: string; farge?: string },
): Kalender {
  kreverForelder(bruker);
  const k = hentKalender(db, id);
  db.prepare("UPDATE kalendere SET navn = ?, farge = ? WHERE id = ?").run(
    data.navn ?? k.navn,
    data.farge ?? k.farge,
    id,
  );
  audit(db, bruker.id, "kalender_endret", { id });
  return hentKalender(db, id);
}

/** Sletter kalenderen og alle avtalene i den. */
export function deleteKalender(db: Db, bruker: AuthUser, id: number): void {
  kreverForelder(bruker);
  hentKalender(db, id);
  const antall = (
    db.prepare("SELECT COUNT(*) AS n FROM events WHERE kalender_id = ?").get(id) as { n: number }
  ).n;
  db.prepare("DELETE FROM kalendere WHERE id = ?").run(id);
  audit(db, bruker.id, "kalender_slettet", { id, avtaler: antall });
}

// Avtaler

const HEND = `SELECT id, kalender_id, tittel, start, slutt, hel_dag, sted, kilde, gjentas_til FROM events`;

interface HendelseRad {
  id: number;
  kalender_id: number;
  tittel: string;
  start: string;
  slutt: string | null;
  hel_dag: number;
  sted: string | null;
  kilde: string;
  gjentas_til: string | null;
}

function tilHendelse(r: HendelseRad, forskyvDager = 0): Hendelse {
  const slutt = r.slutt ?? r.start;
  return {
    id: r.id,
    kalenderId: r.kalender_id,
    tittel: r.tittel,
    start: flyttDager(r.start, forskyvDager),
    slutt: flyttDager(slutt, forskyvDager),
    helDag: r.hel_dag === 1,
    sted: r.sted,
    kilde: r.kilde,
    gjentas: r.gjentas_til ? "ukentlig" : null,
    gjentasTil: r.gjentas_til,
    startOriginal: r.start,
    sluttOriginal: slutt,
  };
}

/** Alle forekomstene av en ukentlig avtale som overlapper [fra, til). */
function forekomster(r: HendelseRad, fra: string, til: string): Hendelse[] {
  const ut: Hendelse[] = [];
  const slutt = r.slutt ?? r.start;
  for (let n = 0; n <= MAKS_GJENTAKELSE_DAGER / 7; n++) {
    const dager = n * 7;
    const start = flyttDager(r.start, dager);
    if (start.slice(0, 10) > (r.gjentas_til ?? "") || start >= `${til}T00:00`) break;
    if (flyttDager(slutt, dager) > `${fra}T00:00`) ut.push(tilHendelse(r, dager));
  }
  return ut;
}

function hentHendelse(db: Db, id: number): HendelseRad {
  const r = db.prepare(`${HEND} WHERE id = ?`).get(id) as HendelseRad | undefined;
  if (!r) throw new HttpError(404, "Fant ikke avtalen");
  return r;
}

/** Avtaler som overlapper [fra, til). Begge er datoer, og «til» er ikke med. Ukentlige avtaler er skrevet ut. */
export function listHendelser(db: Db, fra: string, til: string): Hendelse[] {
  if (!erDato(fra) || !erDato(til)) throw new HttpError(400, "Ugyldig dato");
  const dager = dagerMellom(fra, til);
  if (dager <= 0 || dager > MAKS_DAGER) throw new HttpError(400, "Ugyldig tidsrom");
  const enkelt = db
    .prepare(
      `${HEND}
       WHERE gjentas_til IS NULL AND start < ?
         AND ((slutt IS NOT NULL AND slutt > ?) OR (slutt IS NULL AND start >= ?))
       ORDER BY start, id LIMIT ?`,
    )
    .all(
      `${til}T00:00`,
      `${fra}T00:00`,
      `${fra}T00:00`,
      MAKS_HENDELSER,
    ) as unknown as HendelseRad[];
  // En serie kan begynne lenge før tidsrommet, så den hentes ut fra at den ikke er slutt ennå
  const serier = db
    .prepare(`${HEND} WHERE gjentas_til IS NOT NULL AND start < ? AND gjentas_til >= ? ORDER BY id`)
    .all(`${til}T00:00`, fra) as unknown as HendelseRad[];
  return [...enkelt.map((r) => tilHendelse(r)), ...serier.flatMap((r) => forekomster(r, fra, til))]
    .sort((a, b) => a.start.localeCompare(b.start) || a.id - b.id)
    .slice(0, MAKS_HENDELSER);
}

/** Gjør om det brukeren sendte inn til lagret start og slutt. */
/** Siste dag en ukentlig avtale gjentas, eller null for en vanlig avtale. */
function gjentasTil(data: HendelseInn, start: string): string | null {
  if (!data.gjentas) return null;
  const til = data.gjentasTil;
  if (!til || !erDato(til)) throw new HttpError(400, "Velg hvilken dato avtalen gjentas til");
  const forste = start.slice(0, 10);
  if (til < forste) throw new HttpError(400, "Gjentakelsen kan ikke slutte før avtalen begynner");
  if (dagerMellom(forste, til) > MAKS_GJENTAKELSE_DAGER) {
    throw new HttpError(400, "Avtalen kan gjentas i høyst to år");
  }
  return til;
}

function tidsrom(data: HendelseInn): { start: string; slutt: string } {
  if (data.helDag) {
    const sisteDag = data.slutt || data.start;
    if (!erDato(data.start) || !erDato(sisteDag)) throw new HttpError(400, "Ugyldig dato");
    if (sisteDag < data.start) throw new HttpError(400, "Siste dag kan ikke være før første dag");
    if (dagerMellom(data.start, sisteDag) > MAKS_DAGER)
      throw new HttpError(400, "Avtalen varer for lenge");
    return { start: `${data.start}T00:00`, slutt: `${leggTilDager(sisteDag, 1)}T00:00` };
  }
  if (!erTidspunkt(data.start) || (data.slutt && !erTidspunkt(data.slutt))) {
    throw new HttpError(400, "Ugyldig tidspunkt");
  }
  const slutt = data.slutt || leggTilMinutter(data.start, 60);
  if (slutt <= data.start) throw new HttpError(400, "Slutten må være etter starten");
  return { start: data.start, slutt };
}

/** Bare manuelle kalendere kan endres for hånd. Avtaler som kommer utenfra styres derfra. */
function kreverManuell(kilde: string): void {
  if (kilde !== "manuell") {
    throw new HttpError(409, "Avtaler i denne kalenderen styres av kilden og kan ikke endres her");
  }
}

export function createHendelse(db: Db, bruker: AuthUser, data: HendelseInn): Hendelse {
  kreverForelder(bruker);
  kreverManuell(hentKalender(db, data.kalenderId).kilde);
  const { start, slutt } = tidsrom(data);
  const til = gjentasTil(data, start);
  const res = db
    .prepare(
      `INSERT INTO events (kalender_id, tittel, start, slutt, hel_dag, sted, gjentas_til, opprettet_av)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      data.kalenderId,
      data.tittel,
      start,
      slutt,
      data.helDag ? 1 : 0,
      data.sted || null,
      til,
      bruker.id,
    );
  const id = Number(res.lastInsertRowid);
  audit(db, bruker.id, "avtale_opprettet", { id, kalender: data.kalenderId });
  return tilHendelse(hentHendelse(db, id));
}

export function updateHendelse(db: Db, bruker: AuthUser, id: number, data: HendelseInn): Hendelse {
  kreverForelder(bruker);
  const gammel = hentHendelse(db, id);
  kreverManuell(gammel.kilde);
  kreverManuell(hentKalender(db, data.kalenderId).kilde);
  const { start, slutt } = tidsrom(data);
  const til = gjentasTil(data, start);
  db.prepare(
    "UPDATE events SET kalender_id = ?, tittel = ?, start = ?, slutt = ?, hel_dag = ?, sted = ?, gjentas_til = ? WHERE id = ?",
  ).run(
    data.kalenderId,
    data.tittel,
    start,
    slutt,
    data.helDag ? 1 : 0,
    data.sted || null,
    til,
    id,
  );
  audit(db, bruker.id, "avtale_endret", { id });
  return tilHendelse(hentHendelse(db, id));
}

export function deleteHendelse(db: Db, bruker: AuthUser, id: number): void {
  kreverForelder(bruker);
  const h = hentHendelse(db, id);
  kreverManuell(h.kilde);
  db.prepare("DELETE FROM events WHERE id = ?").run(id);
  audit(db, bruker.id, "avtale_slettet", { id });
}
