import { audit } from "../../core/audit.js";
import type { AuthUser } from "../../core/auth.js";
import { erDato, leggTilDager, osloDato } from "../../core/dato.js";
import { HttpError } from "../../core/errors.js";
import { iTransaksjon } from "../../core/transaksjon.js";
import type { Db } from "../../db/client.js";

const MAKS_PAAMINNELSER = 200;
/** Enkeltdager og perioder som er over, ryddes bort etter så mange dager. */
const DAGER_FOR_OPPRYDDING = 30;

interface Rad {
  id: number;
  barn_id: number;
  barn_navn: string;
  barn_farge: string;
  barn_emoji: string | null;
  tittel: string;
  ukedag: number | null;
  dato: string | null;
  fra: string | null;
  til: string | null;
}

/**
 * En påminnelse er enten fast hver uke på en ukedag (gym), fast i en periode (svømming noen uker, med
 * `fra` og `til`), eller gjelder én bestemt dag (turdag). Enkeltdager har `dato` og ingen `ukedag`.
 */
export interface Paaminnelse {
  id: number;
  barn: { id: number; visningsnavn: string; farge: string; emoji: string | null };
  tittel: string;
  /** 0 = mandag, 6 = søndag. Tom for en enkeltdag. */
  ukedag: number | null;
  /** Enkeltdagen (ÅÅÅÅ-MM-DD). Tom for en fast ukedag. */
  dato: string | null;
  /** Første dag påminnelsen gjelder, for en fast ukedag i en periode. */
  fra: string | null;
  /** Siste dag påminnelsen gjelder. */
  til: string | null;
}

export interface NyPaaminnelse {
  barnIder: number[];
  tittel: string;
  /** Hver uke på disse ukedagene. Mangler for en enkeltdag. */
  ukedager?: number[];
  /** Én bestemt dag. Mangler for fast ukentlig. */
  dato?: string | null;
  fra?: string | null;
  til?: string | null;
}

const SELECT = `
  SELECT p.id, p.barn_id, u.visningsnavn AS barn_navn, u.farge AS barn_farge, u.emoji AS barn_emoji,
         p.tittel, p.ukedag, p.dato, p.fra, p.til
  FROM paaminnelser p JOIN users u ON u.id = p.barn_id`;

const tilPaaminnelse = (r: Rad): Paaminnelse => ({
  id: r.id,
  barn: { id: r.barn_id, visningsnavn: r.barn_navn, farge: r.barn_farge, emoji: r.barn_emoji },
  tittel: r.tittel,
  ukedag: r.ukedag,
  dato: r.dato,
  fra: r.fra,
  til: r.til,
});

function kreverForelder(bruker: AuthUser): void {
  if (bruker.rolle !== "forelder") throw new HttpError(403, "Bare foreldre endrer påminnelser");
}

function hent(db: Db, id: number): Paaminnelse {
  const r = db.prepare(`${SELECT} WHERE p.id = ?`).get(id) as Rad | undefined;
  if (!r) throw new HttpError(404, "Fant ikke påminnelsen");
  return tilPaaminnelse(r);
}

function kreverBarn(db: Db, barnId: number): void {
  const barn = db
    .prepare("SELECT 1 FROM users WHERE id = ? AND rolle = 'barn' AND aktiv = 1")
    .get(barnId);
  if (!barn) throw new HttpError(400, "Påminnelsen må være til et barn");
}

/** Sjekker datoene i en påminnelse: gyldige datoer, og perioden slutter ikke før den begynner. */
function kreverDatoer(d: { dato?: string | null; fra?: string | null; til?: string | null }): void {
  for (const x of [d.dato, d.fra, d.til]) {
    if (x && !erDato(x)) throw new HttpError(400, "Ugyldig dato");
  }
  if (d.fra && d.til && d.til < d.fra)
    throw new HttpError(400, "Perioden slutter før den begynner");
}

/**
 * Påminnelsene som gjelder en bestemt dato: enkeltdagen, eller den faste ukedagen hvis datoen ligger
 * i perioden (når en er satt). `ukedagAvDato` er 0 for mandag.
 */
export function gjelderPaa(
  p: Pick<Paaminnelse, "ukedag" | "dato" | "fra" | "til">,
  dato: string,
  ukedagAvDato: number,
): boolean {
  if (p.dato !== null) return p.dato === dato;
  if (p.ukedag !== ukedagAvDato) return false;
  return (!p.fra || dato >= p.fra) && (!p.til || dato <= p.til);
}

/**
 * Barn ser bare sine egne, voksne ser alle barnas. Enkeltdager og perioder som er over, vises ikke.
 * Sortert: faste ukedager først, så enkeltdager etter dato.
 */
export function listPaaminnelser(db: Db, bruker: AuthUser, naa: number): Paaminnelse[] {
  const idag = osloDato(naa);
  const barn = bruker.rolle === "barn";
  const rader = db
    .prepare(
      `${SELECT}
       WHERE (p.dato IS NULL OR p.dato >= ?) AND (p.til IS NULL OR p.til >= ?) ${barn ? "AND p.barn_id = ?" : ""}
       ORDER BY (p.dato IS NOT NULL), p.ukedag, p.dato, u.visningsnavn COLLATE NOCASE, p.tittel, p.id LIMIT ?`,
    )
    .all(idag, idag, ...(barn ? [bruker.id] : []), MAKS_PAAMINNELSER) as unknown as Rad[];
  return rader.map(tilPaaminnelse);
}

/**
 * Legger påminnelsen inn for hvert barn: på hver ukedag (eventuelt bare i en periode), eller på én dato.
 * En som finnes fra før (samme barn, dag, periode og tittel) legges ikke inn på nytt, men kommer med i svaret.
 */
export function createPaaminnelser(
  db: Db,
  bruker: AuthUser,
  data: NyPaaminnelse,
  naa: number,
): Paaminnelse[] {
  kreverForelder(bruker);
  kreverDatoer(data);
  const enkeltdag = !!data.dato;
  if (enkeltdag === (data.ukedager !== undefined) || (enkeltdag && (data.fra || data.til))) {
    throw new HttpError(400, "Velg enten faste ukedager eller én dato");
  }
  const barnIder = [...new Set(data.barnIder)];
  const dager: (number | null)[] = enkeltdag ? [null] : [...new Set(data.ukedager)];
  const fra = enkeltdag ? null : data.fra || null;
  const til = enkeltdag ? null : data.til || null;
  const opprydding = leggTilDager(osloDato(naa), -DAGER_FOR_OPPRYDDING);
  const ider = iTransaksjon(db, () => {
    db.prepare("DELETE FROM paaminnelser WHERE dato < ? OR til < ?").run(opprydding, opprydding);
    const antall = (db.prepare("SELECT COUNT(*) AS n FROM paaminnelser").get() as { n: number }).n;
    if (antall + barnIder.length * dager.length > MAKS_PAAMINNELSER) {
      throw new HttpError(400, "For mange påminnelser. Slett noen først.");
    }
    return barnIder.flatMap((barnId) => {
      kreverBarn(db, barnId);
      return dager.map((ukedag) => {
        const dato = enkeltdag ? data.dato! : null;
        db.prepare(
          "INSERT OR IGNORE INTO paaminnelser (barn_id, tittel, ukedag, dato, fra, til, opprettet_av) VALUES (?, ?, ?, ?, ?, ?, ?)",
        ).run(barnId, data.tittel, ukedag, dato, fra, til, bruker.id);
        const rad = db
          .prepare(
            "SELECT id FROM paaminnelser WHERE barn_id = ? AND tittel = ? AND ukedag IS ? AND dato IS ? AND fra IS ? AND til IS ?",
          )
          .get(barnId, data.tittel, ukedag, dato, fra, til) as { id: number };
        return rad.id;
      });
    });
  });
  audit(db, bruker.id, "paaminnelse_lagt_inn", {
    barn: barnIder,
    ukedager: enkeltdag ? null : dager,
    dato: data.dato ?? null,
    antall: ider.length,
  });
  return ider.map((id) => hent(db, id));
}

export function updatePaaminnelse(
  db: Db,
  bruker: AuthUser,
  id: number,
  data: {
    tittel?: string;
    ukedag?: number;
    dato?: string | null;
    fra?: string | null;
    til?: string | null;
  },
): Paaminnelse {
  kreverForelder(bruker);
  const p = hent(db, id);
  const enkeltdag = p.dato !== null;
  if (enkeltdag && (data.ukedag !== undefined || data.fra || data.til)) {
    throw new HttpError(400, "En enkeltdag har bare dato");
  }
  if (!enkeltdag && data.dato) throw new HttpError(400, "En fast påminnelse har ukedag, ikke dato");
  const ny = {
    tittel: data.tittel ?? p.tittel,
    ukedag: data.ukedag ?? p.ukedag,
    dato: enkeltdag ? (data.dato ?? p.dato) : null,
    fra: enkeltdag ? null : data.fra === undefined ? p.fra : data.fra || null,
    til: enkeltdag ? null : data.til === undefined ? p.til : data.til || null,
  };
  kreverDatoer(ny);
  try {
    db.prepare(
      "UPDATE paaminnelser SET tittel = ?, ukedag = ?, dato = ?, fra = ?, til = ? WHERE id = ?",
    ).run(ny.tittel, ny.ukedag, ny.dato, ny.fra, ny.til, id);
  } catch {
    throw new HttpError(409, "Den påminnelsen finnes allerede");
  }
  audit(db, bruker.id, "paaminnelse_endret", { id });
  return hent(db, id);
}

export function deletePaaminnelse(db: Db, bruker: AuthUser, id: number): void {
  kreverForelder(bruker);
  hent(db, id);
  db.prepare("DELETE FROM paaminnelser WHERE id = ?").run(id);
  audit(db, bruker.id, "paaminnelse_slettet", { id });
}
