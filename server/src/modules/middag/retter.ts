import { audit } from "../../core/audit.js";
import type { AuthUser } from "../../core/auth.js";
import { HttpError } from "../../core/errors.js";
import type { Db } from "../../db/client.js";
import { normaliser } from "../handleliste/service.js";

const MAKS_INGREDIENSER = 40;

export interface Rett {
  id: number;
  tittel: string;
  notat: string | null;
  ingredienser: string[];
  /** Snittet av alle stjerner denne retten har fått, eller null hvis ingen har gitt noen. */
  snitt: number | null;
  antall: number;
  /** Snittet av stjernene brukeren selv har gitt retten. */
  minSnitt: number | null;
  minAntall: number;
}

/** Barn får bare det de trenger for å se listen og scoren: ingen notat og ingen ingredienser. */
export type RettForBarn = Omit<Rett, "notat" | "ingredienser">;

interface Rad {
  id: number;
  tittel: string;
  notat: string | null;
  ingredienser: string;
  snitt: number | null;
  antall: number;
  min_snitt: number | null;
  min_antall: number;
}

const rund = (n: number | null) => (n === null ? null : Math.round(n * 100) / 100);

const STATISTIKK = `
  (SELECT AVG(s.stjerner) FROM middag_stjerner s JOIN middag m ON m.dato = s.dato WHERE m.rett_id = r.id) AS snitt,
  (SELECT COUNT(*) FROM middag_stjerner s JOIN middag m ON m.dato = s.dato WHERE m.rett_id = r.id) AS antall,
  (SELECT AVG(s.stjerner) FROM middag_stjerner s JOIN middag m ON m.dato = s.dato WHERE m.rett_id = r.id AND s.user_id = ?) AS min_snitt,
  (SELECT COUNT(*) FROM middag_stjerner s JOIN middag m ON m.dato = s.dato WHERE m.rett_id = r.id AND s.user_id = ?) AS min_antall`;

function tilRett(r: Rad): Rett {
  return {
    id: r.id,
    tittel: r.tittel,
    notat: r.notat,
    ingredienser: JSON.parse(r.ingredienser) as string[],
    snitt: rund(r.snitt),
    antall: r.antall,
    minSnitt: rund(r.min_snitt),
    minAntall: r.min_antall,
  };
}

function kreverForelder(bruker: AuthUser): void {
  if (bruker.rolle !== "forelder")
    throw new HttpError(403, "Bare foreldre kan endre middagsrettene");
}

/** Best snitt først, så flest stemmer, så alfabetisk. Retter uten stemmer kommer sist. */
function sorter(a: Rett, b: Rett): number {
  if ((a.snitt === null) !== (b.snitt === null)) return a.snitt === null ? 1 : -1;
  return (
    (b.snitt ?? 0) - (a.snitt ?? 0) || b.antall - a.antall || a.tittel.localeCompare(b.tittel, "nb")
  );
}

export function listRetter(db: Db, bruker: AuthUser): (Rett | RettForBarn)[] {
  const rader = db
    .prepare(`SELECT r.id, r.tittel, r.notat, r.ingredienser, ${STATISTIKK} FROM retter r`)
    .all(bruker.id, bruker.id) as unknown as Rad[];
  const retter = rader.map(tilRett).sort(sorter);
  if (bruker.rolle === "forelder") return retter;
  return retter.map(({ notat: _n, ingredienser: _i, ...rett }) => rett);
}

function hentRett(db: Db, id: number, brukerId: number): Rett {
  const rad = db
    .prepare(
      `SELECT r.id, r.tittel, r.notat, r.ingredienser, ${STATISTIKK} FROM retter r WHERE r.id = ?`,
    )
    .get(brukerId, brukerId, id) as Rad | undefined;
  if (!rad) throw new HttpError(404, "Fant ikke retten");
  return tilRett(rad);
}

/** Rensker listen: fjerner tomme linjer og dubletter (uavhengig av store og små bokstaver). */
function renseIngredienser(liste: string[]): string[] {
  const sett = new Set<string>();
  const ut: string[] = [];
  for (const i of liste) {
    const navn = i.trim().replace(/\s+/g, " ");
    if (!navn || sett.has(normaliser(navn))) continue;
    sett.add(normaliser(navn));
    ut.push(navn);
  }
  if (ut.length > MAKS_INGREDIENSER) {
    throw new HttpError(400, `En rett kan ha opptil ${MAKS_INGREDIENSER} ingredienser`);
  }
  return ut;
}

export interface RettInn {
  tittel: string;
  notat?: string | null;
  ingredienser: string[];
}

function kreverLedigTittel(db: Db, tittel: string, unntattId?: number): string {
  const norm = normaliser(tittel);
  const finnes = db
    .prepare("SELECT id FROM retter WHERE tittel_norm = ? AND id <> ?")
    .get(norm, unntattId ?? 0);
  if (finnes) throw new HttpError(409, "Det finnes allerede en rett med det navnet");
  return norm;
}

export function createRett(db: Db, bruker: AuthUser, data: RettInn): Rett {
  kreverForelder(bruker);
  const norm = kreverLedigTittel(db, data.tittel);
  const res = db
    .prepare(
      "INSERT INTO retter (tittel, tittel_norm, notat, ingredienser, opprettet_av) VALUES (?, ?, ?, ?, ?)",
    )
    .run(
      data.tittel,
      norm,
      data.notat || null,
      JSON.stringify(renseIngredienser(data.ingredienser)),
      bruker.id,
    );
  const id = Number(res.lastInsertRowid);
  audit(db, bruker.id, "rett_opprettet", { id });
  return hentRett(db, id, bruker.id);
}

/** Endrer en rett. Dager som allerede er planlagt med retten får det nye navnet, men ikke nye ingredienser. */
export function updateRett(db: Db, bruker: AuthUser, id: number, data: RettInn): Rett {
  kreverForelder(bruker);
  hentRett(db, id, bruker.id);
  const norm = kreverLedigTittel(db, data.tittel, id);
  db.prepare(
    `UPDATE retter SET tittel = ?, tittel_norm = ?, notat = ?, ingredienser = ?,
       endret = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?`,
  ).run(
    data.tittel,
    norm,
    data.notat || null,
    JSON.stringify(renseIngredienser(data.ingredienser)),
    id,
  );
  db.prepare("UPDATE middag SET rett = ? WHERE rett_id = ?").run(data.tittel, id);
  audit(db, bruker.id, "rett_endret", { id });
  return hentRett(db, id, bruker.id);
}

/** Dager som er planlagt med retten beholder navnet, men er ikke lenger knyttet til noen rett. */
export function deleteRett(db: Db, bruker: AuthUser, id: number): void {
  kreverForelder(bruker);
  hentRett(db, id, bruker.id);
  db.prepare("DELETE FROM retter WHERE id = ?").run(id);
  audit(db, bruker.id, "rett_slettet", { id });
}

export function hentRettForPlan(
  db: Db,
  id: number,
): { id: number; tittel: string; ingredienser: string[] } {
  const rad = db.prepare("SELECT id, tittel, ingredienser FROM retter WHERE id = ?").get(id) as
    { id: number; tittel: string; ingredienser: string } | undefined;
  if (!rad) throw new HttpError(404, "Fant ikke retten");
  return { id: rad.id, tittel: rad.tittel, ingredienser: JSON.parse(rad.ingredienser) as string[] };
}
