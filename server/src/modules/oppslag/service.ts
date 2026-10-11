import { audit } from "../../core/audit.js";
import type { AuthUser } from "../../core/auth.js";
import { HttpError } from "../../core/errors.js";
import type { Db } from "../../db/client.js";

export const LAPPFARGER = ["gul", "rosa", "blå", "grønn", "oransje"] as const;
export type Lappfarge = (typeof LAPPFARGER)[number];

const MAKS_LAPPER = 200;

interface LappRad {
  id: number;
  tekst: string;
  farge: Lappfarge;
  opprettet: string;
  endret: string | null;
  forfatter_id: number;
  forfatter_navn: string;
  forfatter_farge: string;
  forfatter_emoji: string | null;
}

export interface Lapp {
  id: number;
  tekst: string;
  farge: Lappfarge;
  opprettet: string;
  endret: string | null;
  forfatter: { id: number; visningsnavn: string; farge: string; emoji: string | null };
  /** Forfatteren selv og foreldre kan endre og slette. */
  kanEndre: boolean;
}

const SELECT = `
  SELECT l.id, l.tekst, l.farge, l.opprettet, l.endret, l.forfatter_id,
         u.visningsnavn AS forfatter_navn, u.farge AS forfatter_farge, u.emoji AS forfatter_emoji
  FROM lapper l JOIN users u ON u.id = l.forfatter_id`;

function tilLapp(rad: LappRad, bruker: AuthUser): Lapp {
  return {
    id: rad.id,
    tekst: rad.tekst,
    farge: rad.farge,
    opprettet: rad.opprettet,
    endret: rad.endret,
    forfatter: {
      id: rad.forfatter_id,
      visningsnavn: rad.forfatter_navn,
      farge: rad.forfatter_farge,
      emoji: rad.forfatter_emoji,
    },
    kanEndre: kanEndre(bruker, rad.forfatter_id),
  };
}

function kanEndre(bruker: AuthUser, forfatterId: number): boolean {
  return bruker.rolle === "forelder" || bruker.id === forfatterId;
}

export function listLapper(db: Db, bruker: AuthUser): Lapp[] {
  const rader = db
    .prepare(`${SELECT} ORDER BY l.opprettet DESC, l.id DESC LIMIT ?`)
    .all(MAKS_LAPPER) as unknown as LappRad[];
  return rader.map((r) => tilLapp(r, bruker));
}

function hentLapp(db: Db, id: number, bruker: AuthUser): Lapp {
  const rad = db.prepare(`${SELECT} WHERE l.id = ?`).get(id) as LappRad | undefined;
  if (!rad) throw new HttpError(404, "Fant ikke lappen");
  return tilLapp(rad, bruker);
}

/** Henter lappen og sjekker at brukeren har lov til å endre den. */
function hentEndrbar(db: Db, id: number, bruker: AuthUser): Lapp {
  const lapp = hentLapp(db, id, bruker);
  if (!lapp.kanEndre) throw new HttpError(403, "Du kan bare endre dine egne lapper");
  return lapp;
}

export function createLapp(
  db: Db,
  bruker: AuthUser,
  data: { tekst: string; farge: Lappfarge },
): Lapp {
  const res = db
    .prepare("INSERT INTO lapper (forfatter_id, tekst, farge) VALUES (?, ?, ?)")
    .run(bruker.id, data.tekst, data.farge);
  const id = Number(res.lastInsertRowid);
  audit(db, bruker.id, "lapp_opprettet", { id });
  return hentLapp(db, id, bruker);
}

export function updateLapp(
  db: Db,
  bruker: AuthUser,
  id: number,
  data: { tekst?: string; farge?: Lappfarge },
): Lapp {
  const lapp = hentEndrbar(db, id, bruker);
  db.prepare("UPDATE lapper SET tekst = ?, farge = ?, endret = ? WHERE id = ?").run(
    data.tekst ?? lapp.tekst,
    data.farge ?? lapp.farge,
    new Date().toISOString(),
    id,
  );
  audit(db, bruker.id, "lapp_endret", { id, forfatter: lapp.forfatter.id });
  return hentLapp(db, id, bruker);
}

export function deleteLapp(db: Db, bruker: AuthUser, id: number): void {
  const lapp = hentEndrbar(db, id, bruker);
  db.prepare("DELETE FROM lapper WHERE id = ?").run(id);
  audit(db, bruker.id, "lapp_slettet", { id, forfatter: lapp.forfatter.id });
}
