import { audit } from "../../core/audit.js";
import type { AuthUser } from "../../core/auth.js";
import { erDato, leggTilDager, osloDato } from "../../core/dato.js";
import { HttpError } from "../../core/errors.js";
import { iTransaksjon } from "../../core/transaksjon.js";
import type { Db } from "../../db/client.js";

/** Hvor mange dager tilbake gjorte lekser vises. Lekser som ikke er gjort vises uansett. */
const DAGER_GJORTE = 14;
const MAKS_LEKSER = 300;

interface Rad {
  id: number;
  barn_id: number;
  barn_navn: string;
  barn_farge: string;
  barn_emoji: string | null;
  fag: string | null;
  tittel: string;
  fritekst: string | null;
  frist: string;
  gjort: string | null;
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

export interface NyLekse {
  barnIder: number[];
  tittel: string;
  fag?: string | null;
  fritekst?: string | null;
  frist: string;
}

const SELECT = `
  SELECT l.id, l.barn_id, u.visningsnavn AS barn_navn, u.farge AS barn_farge, u.emoji AS barn_emoji,
         l.fag, l.tittel, l.fritekst, l.frist, l.gjort
  FROM lekser l JOIN users u ON u.id = l.barn_id`;

const tilLekse = (r: Rad): Lekse => ({
  id: r.id,
  barn: { id: r.barn_id, visningsnavn: r.barn_navn, farge: r.barn_farge, emoji: r.barn_emoji },
  fag: r.fag,
  tittel: r.tittel,
  fritekst: r.fritekst,
  frist: r.frist,
  gjort: r.gjort !== null,
});

function kreverForelder(bruker: AuthUser): void {
  if (bruker.rolle !== "forelder") throw new HttpError(403, "Bare foreldre legger inn lekser");
}

function hent(db: Db, id: number): Lekse {
  const r = db.prepare(`${SELECT} WHERE l.id = ?`).get(id) as Rad | undefined;
  if (!r) throw new HttpError(404, "Fant ikke leksa");
  return tilLekse(r);
}

function kreverFrist(frist: string): void {
  if (!erDato(frist)) throw new HttpError(400, "Ugyldig dato");
}

/**
 * Lekser som ikke er gjort, og de som ble gjort de siste to ukene. Barn ser bare sine egne,
 * voksne ser alle barnas. Sortert etter frist.
 */
export function listLekser(db: Db, bruker: AuthUser, naa: number): Lekse[] {
  const fra = leggTilDager(osloDato(naa), -DAGER_GJORTE);
  const barn = bruker.rolle === "barn";
  const rader = db
    .prepare(
      `${SELECT}
       WHERE (l.gjort IS NULL OR l.frist >= ?) ${barn ? "AND l.barn_id = ?" : ""}
       ORDER BY l.frist, u.visningsnavn COLLATE NOCASE, l.id LIMIT ?`,
    )
    .all(...(barn ? [fra, bruker.id] : [fra]), MAKS_LEKSER) as unknown as Rad[];
  return rader.map(tilLekse);
}

/** Legger samme lekse inn for ett eller flere barn, én rad per barn. */
export function createLekser(db: Db, bruker: AuthUser, data: NyLekse): Lekse[] {
  kreverForelder(bruker);
  kreverFrist(data.frist);
  const ider = [...new Set(data.barnIder)];
  const ut = iTransaksjon(db, () =>
    ider.map((barnId) => {
      const barn = db
        .prepare("SELECT 1 FROM users WHERE id = ? AND rolle = 'barn' AND aktiv = 1")
        .get(barnId);
      if (!barn) throw new HttpError(400, "Leksa må være til et barn");
      const res = db
        .prepare(
          "INSERT INTO lekser (barn_id, fag, tittel, fritekst, frist, opprettet_av) VALUES (?, ?, ?, ?, ?, ?)",
        )
        .run(
          barnId,
          data.fag?.trim() || null,
          data.tittel,
          data.fritekst?.trim() || null,
          data.frist,
          bruker.id,
        );
      return Number(res.lastInsertRowid);
    }),
  );
  audit(db, bruker.id, "lekse_lagt_inn", { barn: ider, frist: data.frist });
  return ut.map((id) => hent(db, id));
}

export function updateLekse(
  db: Db,
  bruker: AuthUser,
  id: number,
  data: { tittel?: string; fag?: string | null; fritekst?: string | null; frist?: string },
): Lekse {
  kreverForelder(bruker);
  const l = hent(db, id);
  if (data.frist !== undefined) kreverFrist(data.frist);
  const fag = data.fag === undefined ? l.fag : data.fag?.trim() || null;
  const fritekst = data.fritekst === undefined ? l.fritekst : data.fritekst?.trim() || null;
  db.prepare("UPDATE lekser SET tittel = ?, fag = ?, fritekst = ?, frist = ? WHERE id = ?").run(
    data.tittel ?? l.tittel,
    fag,
    fritekst,
    data.frist ?? l.frist,
    id,
  );
  audit(db, bruker.id, "lekse_endret", { id });
  return hent(db, id);
}

export function deleteLekse(db: Db, bruker: AuthUser, id: number): void {
  kreverForelder(bruker);
  hent(db, id);
  db.prepare("DELETE FROM lekser WHERE id = ?").run(id);
  audit(db, bruker.id, "lekse_slettet", { id });
}

/** Barnet krysser av sin egen lekse, og en voksen kan krysse av for alle. Å krysse av to ganger gjør ingenting. */
export function settGjort(db: Db, bruker: AuthUser, id: number, gjort: boolean): Lekse {
  if (bruker.rolle === "besteforelder")
    throw new HttpError(403, "Besteforeldre kan ikke krysse av");
  const l = hent(db, id);
  if (bruker.rolle === "barn" && l.barn.id !== bruker.id) {
    throw new HttpError(403, "Du kan bare krysse av dine egne lekser");
  }
  if (gjort) {
    db.prepare(
      "UPDATE lekser SET gjort = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), gjort_av = ? WHERE id = ? AND gjort IS NULL",
    ).run(bruker.id, id);
  } else {
    db.prepare("UPDATE lekser SET gjort = NULL, gjort_av = NULL WHERE id = ?").run(id);
  }
  audit(db, bruker.id, gjort ? "lekse_gjort" : "lekse_angret", { id, barn: l.barn.id });
  return hent(db, id);
}
