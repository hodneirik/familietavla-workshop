import { audit } from "../../core/audit.js";
import { destroyUserSessions, type Rolle } from "../../core/auth.js";
import { HttpError } from "../../core/errors.js";
import { hashPin, pinErGyldig } from "../../core/pin.js";
import { PROFILFARGER, STANDARD_PROFILFARGE } from "../../core/profilfarger.js";
import type { Db } from "../../db/client.js";

export interface UserRow {
  id: number;
  visningsnavn: string;
  rolle: Rolle;
  farge: string;
  emoji: string | null;
  aktiv: number;
}

const COLUMNS = "id, visningsnavn, rolle, farge, emoji, aktiv";

export function listUsers(db: Db, kunAktive: boolean): UserRow[] {
  const where = kunAktive ? "WHERE aktiv = 1" : "";
  return db
    .prepare(`SELECT ${COLUMNS} FROM users ${where} ORDER BY rolle = 'barn', visningsnavn`)
    .all() as unknown as UserRow[];
}

export function getUser(db: Db, id: number): UserRow {
  const user = db.prepare(`SELECT ${COLUMNS} FROM users WHERE id = ?`).get(id) as
    UserRow | undefined;
  if (!user) throw new HttpError(404, "Fant ikke brukeren");
  return user;
}

export interface NyBruker {
  visningsnavn: string;
  rolle: Rolle;
  farge?: string;
  emoji?: string | null;
  pin: string;
}

export function createUser(db: Db, data: NyBruker, utfortAv: number | null): UserRow {
  if (!pinErGyldig(data.pin)) {
    throw new HttpError(400, "PIN må være 4 sifre");
  }
  if (data.farge && !(PROFILFARGER as readonly string[]).includes(data.farge)) {
    throw new HttpError(400, `Fargen må være en av: ${PROFILFARGER.join(", ")}`);
  }
  const res = db
    .prepare(
      "INSERT INTO users (visningsnavn, rolle, farge, emoji, pin_hash) VALUES (?, ?, ?, ?, ?)",
    )
    .run(
      data.visningsnavn,
      data.rolle,
      data.farge ?? STANDARD_PROFILFARGE,
      data.emoji ?? null,
      hashPin(data.pin),
    );
  const id = Number(res.lastInsertRowid);
  audit(db, utfortAv, "bruker_opprettet", { id, rolle: data.rolle });
  return getUser(db, id);
}

function antallAktiveForeldre(db: Db): number {
  const r = db
    .prepare("SELECT COUNT(*) AS n FROM users WHERE rolle = 'forelder' AND aktiv = 1")
    .get() as {
    n: number;
  };
  return r.n;
}

export interface Endring {
  visningsnavn?: string;
  rolle?: Rolle;
  farge?: string;
  emoji?: string | null;
  aktiv?: boolean;
}

export function updateUser(db: Db, id: number, endring: Endring, utfortAv: number): UserRow {
  const gammel = getUser(db, id);
  const ny = {
    visningsnavn: endring.visningsnavn ?? gammel.visningsnavn,
    rolle: endring.rolle ?? gammel.rolle,
    farge: endring.farge ?? gammel.farge,
    emoji: endring.emoji === undefined ? gammel.emoji : endring.emoji,
    aktiv: endring.aktiv === undefined ? gammel.aktiv : endring.aktiv ? 1 : 0,
  };
  const mistetForelder =
    gammel.rolle === "forelder" &&
    gammel.aktiv === 1 &&
    (ny.rolle !== "forelder" || ny.aktiv === 0);
  if (mistetForelder && antallAktiveForeldre(db) <= 1) {
    throw new HttpError(409, "Det må alltid finnes minst én aktiv forelder");
  }
  db.prepare(
    "UPDATE users SET visningsnavn = ?, rolle = ?, farge = ?, emoji = ?, aktiv = ? WHERE id = ?",
  ).run(ny.visningsnavn, ny.rolle, ny.farge, ny.emoji, ny.aktiv, id);
  if (ny.aktiv === 0 || ny.rolle !== gammel.rolle) destroyUserSessions(db, id);
  audit(db, utfortAv, "bruker_endret", { id, endring });
  return getUser(db, id);
}

export function setPin(
  db: Db,
  id: number,
  pin: string,
  utfortAv: number | null,
  handling = "pin_endret",
): void {
  getUser(db, id); // Sier fra med 404 hvis brukeren ikke finnes
  if (!pinErGyldig(pin)) {
    throw new HttpError(400, "PIN må være 4 sifre");
  }
  db.prepare("UPDATE users SET pin_hash = ? WHERE id = ?").run(hashPin(pin), id);
  db.prepare("DELETE FROM auth_attempts WHERE user_id = ?").run(id);
  audit(db, utfortAv, handling, { id });
}
