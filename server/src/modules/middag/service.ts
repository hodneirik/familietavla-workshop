import { audit } from "../../core/audit.js";
import type { AuthUser } from "../../core/auth.js";
import { dagerMellom, erDato, osloDato } from "../../core/dato.js";
import { HttpError } from "../../core/errors.js";
import { iTransaksjon } from "../../core/transaksjon.js";
import type { Db } from "../../db/client.js";
import { parseIngrediens } from "../../core/ingrediens.js";
import { fjernFraMiddag, leggTilFraMiddag, normaliser } from "../handleliste/service.js";
import { hentRettForPlan } from "./retter.js";

const MAKS_DAGER = 62;

export interface Middag {
  dato: string;
  /** Null hvis retten er slettet etter at dagen ble planlagt. */
  rettId: number | null;
  rett: string;
  notat: string | null;
  /** Stjernene brukeren selv har gitt denne dagens middag. */
  minStjerner: number | null;
}

interface Rad {
  dato: string;
  rett_id: number | null;
  rett: string;
  notat: string | null;
  min: number | null;
}

function kreverForelder(bruker: AuthUser): void {
  if (bruker.rolle !== "forelder") throw new HttpError(403, "Bare foreldre kan planlegge middag");
}

function kreverDato(dato: string): void {
  if (!erDato(dato)) throw new HttpError(400, "Ugyldig dato");
}

const SELECT = `
  SELECT m.dato, m.rett_id, m.rett, r.notat,
         (SELECT s.stjerner FROM middag_stjerner s WHERE s.dato = m.dato AND s.user_id = ?) AS min
  FROM middag m LEFT JOIN retter r ON r.id = m.rett_id`;

const tilMiddag = (r: Rad): Middag => ({
  dato: r.dato,
  rettId: r.rett_id,
  rett: r.rett,
  notat: r.notat,
  minStjerner: r.min,
});

function hentMiddag(db: Db, dato: string, brukerId: number): Middag | null {
  const rad = db.prepare(`${SELECT} WHERE m.dato = ?`).get(brukerId, dato) as Rad | undefined;
  return rad ? tilMiddag(rad) : null;
}

/** Middagene fra og med «fra» til og uten «til». */
export function listMiddag(db: Db, bruker: AuthUser, fra: string, til: string): Middag[] {
  kreverDato(fra);
  kreverDato(til);
  const dager = dagerMellom(fra, til);
  if (dager <= 0 || dager > MAKS_DAGER) throw new HttpError(400, "Ugyldig tidsrom");
  const rader = db
    .prepare(`${SELECT} WHERE m.dato >= ? AND m.dato < ? ORDER BY m.dato`)
    .all(bruker.id, fra, til) as unknown as Rad[];
  return rader.map(tilMiddag);
}

/**
 * Velger en rett for en dag. De valgte ingrediensene legges på handlelisten, med når de må handles innen i notatet.
 * Utelates `valgte`, legges alle ingrediensene på lista. En tom liste betyr at ingenting legges på lista.
 * Byttes retten, tas ingrediensene til den forrige bort igjen, og stjernene for dagen nullstilles.
 */
export function settMiddag(
  db: Db,
  bruker: AuthUser,
  dato: string,
  rettId: number,
  valgte?: string[],
): Middag {
  kreverForelder(bruker);
  kreverDato(dato);
  const rett = hentRettForPlan(db, rettId);

  // Bare ingredienser som finnes i retten kan velges
  let skalPaaLista = rett.ingredienser;
  if (valgte) {
    const ønsket = new Set(valgte.map(normaliser));
    const kjente = new Set(rett.ingredienser.map(normaliser));
    if ([...ønsket].some((i) => !kjente.has(i))) {
      throw new HttpError(400, "Det finnes en ingrediens som ikke er i retten");
    }
    skalPaaLista = rett.ingredienser.filter((i) => ønsket.has(normaliser(i)));
  }

  const finnes = db.prepare("SELECT rett_id FROM middag WHERE dato = ?").get(dato) as
    { rett_id: number | null } | undefined;
  if (finnes?.rett_id === rettId) return hentMiddag(db, dato, bruker.id)!;

  iTransaksjon(db, () => {
    if (finnes) {
      fjernFraMiddag(db, dato);
      db.prepare("DELETE FROM middag WHERE dato = ?").run(dato);
    }
    db.prepare("INSERT INTO middag (dato, rett_id, rett, opprettet_av) VALUES (?, ?, ?, ?)").run(
      dato,
      rett.id,
      rett.tittel,
      bruker.id,
    );
    // Hver linje er en vare med mengde («400 g kjøttdeig»). Samme vare på lista får mengdene lagt sammen.
    for (const linje of skalPaaLista) {
      const i = parseIngrediens(linje);
      const vare = leggTilFraMiddag(db, bruker, i.navn);
      db.prepare(
        `INSERT INTO handleliste_middag (vare_id, dato, ny, mengde, enhet) VALUES (?, ?, ?, ?, ?)
         ON CONFLICT (vare_id, dato) DO UPDATE SET
           mengde = CASE WHEN mengde IS NOT NULL AND excluded.mengde IS NOT NULL
                          AND COALESCE(enhet, 'stk') = COALESCE(excluded.enhet, 'stk')
                         THEN mengde + excluded.mengde ELSE mengde END`,
      ).run(vare.id, dato, vare.ny ? 1 : 0, i.mengde, i.enhet);
    }
  });
  audit(db, bruker.id, "middag_satt", { dato, rettId, paaLista: skalPaaLista.length });
  return hentMiddag(db, dato, bruker.id)!;
}

export function slettMiddag(db: Db, bruker: AuthUser, dato: string): void {
  kreverForelder(bruker);
  kreverDato(dato);
  if (!db.prepare("SELECT 1 FROM middag WHERE dato = ?").get(dato)) {
    throw new HttpError(404, "Det er ingen middag den dagen");
  }
  iTransaksjon(db, () => {
    fjernFraMiddag(db, dato);
    db.prepare("DELETE FROM middag WHERE dato = ?").run(dato);
  });
  audit(db, bruker.id, "middag_fjernet", { dato });
}

/** Barna gir dagens middag fra 1 til 5 stjerner, og kan endre dem senere samme dag. Voksne ser bare snittet. */
export function giStjerner(
  db: Db,
  bruker: AuthUser,
  dato: string,
  stjerner: number,
  naa: number,
): Middag {
  if (bruker.rolle !== "barn") throw new HttpError(403, "Bare barna gir stjerner");
  kreverDato(dato);
  if (dato !== osloDato(naa)) {
    throw new HttpError(409, "Du kan bare gi stjerner til dagens middag");
  }
  if (!db.prepare("SELECT 1 FROM middag WHERE dato = ?").get(dato)) {
    throw new HttpError(404, "Det er ingen middag i dag");
  }
  db.prepare(
    `INSERT INTO middag_stjerner (dato, user_id, stjerner) VALUES (?, ?, ?)
     ON CONFLICT (dato, user_id) DO UPDATE SET stjerner = excluded.stjerner,
       tidspunkt = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`,
  ).run(dato, bruker.id, stjerner);
  audit(db, bruker.id, "stjerner_gitt", { dato, stjerner });
  return hentMiddag(db, dato, bruker.id)!;
}
