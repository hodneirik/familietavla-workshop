import { copyFileSync, mkdirSync, readdirSync, rmSync, chmodSync, existsSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { Db } from "./client.js";

export const BEHOLD = 14;
const MONSTER = /^tavla-\d{8}-\d{6}\.db$/;

function tidsstempel(d: Date): string {
  const iso = d.toISOString(); // 2026-10-06T03:00:00.000Z
  return `${iso.slice(0, 10).replaceAll("-", "")}-${iso.slice(11, 19).replaceAll(":", "")}`;
}

export interface Sjekk {
  brukere: number;
}

/** Åpner en databasefil skrivebeskyttet, kjører integritetssjekk og sjekker at den ligner en tavle-database. */
export function sjekkDatabase(fil: string): Sjekk {
  const db = new DatabaseSync(fil, { readOnly: true });
  try {
    const rader = db.prepare("PRAGMA integrity_check").all() as { integrity_check: string }[];
    if (rader.length !== 1 || rader[0]?.integrity_check !== "ok") {
      throw new Error(`Databasen ${fil} er skadet (integritetssjekk feilet)`);
    }
    const r = db.prepare("SELECT COUNT(*) AS n FROM users").get() as { n: number };
    return { brukere: r.n };
  } catch (err) {
    if (err instanceof Error && err.message.includes("skadet")) throw err;
    throw new Error(
      `${fil} ser ikke ut som en Familietavla-database: ${err instanceof Error ? err.message : err}`,
    );
  } finally {
    db.close();
  }
}

/** Beholder de nyeste `behold` backupene i mappen og sletter resten. */
export function rydd(dir: string, behold = BEHOLD): string[] {
  const filer = readdirSync(dir)
    .filter((f) => MONSTER.test(f))
    .sort();
  const slett = filer.slice(0, Math.max(0, filer.length - behold));
  for (const f of slett) rmSync(path.join(dir, f));
  return slett;
}

/** Tar en konsistent kopi mens appen kjører (VACUUM INTO), verifiserer den og rydder gamle. */
export function lagBackup(db: Db, dataDir: string, nå = new Date(), behold = BEHOLD) {
  const dir = path.join(dataDir, "backups");
  mkdirSync(dir, { recursive: true });
  const navn = `tavla-${tidsstempel(nå)}.db`;
  const fil = path.join(dir, navn);
  if (existsSync(fil)) throw new Error(`Backup ${navn} finnes allerede`);
  db.exec(`VACUUM INTO '${fil.replaceAll("'", "''")}'`);
  let sjekk: Sjekk;
  try {
    sjekk = sjekkDatabase(fil);
  } catch (err) {
    rmSync(fil, { force: true });
    throw err;
  }
  chmodSync(fil, 0o644);
  const slettet = rydd(dir, behold);
  return { navn, fil, brukere: sjekk.brukere, slettet };
}

/** Legger en backup tilbake som aktiv database. Dagens database tas vare på ved siden av. */
export function gjenopprett(fil: string, dataDir: string, nå = new Date()) {
  const sjekk = sjekkDatabase(fil);
  mkdirSync(dataDir, { recursive: true });
  const mål = path.join(dataDir, "tavla.db");
  let reserve: string | null = null;
  if (existsSync(mål)) {
    reserve = `${mål}.før-gjenoppretting-${tidsstempel(nå)}`;
    copyFileSync(mål, reserve);
  }
  rmSync(`${mål}-wal`, { force: true });
  rmSync(`${mål}-shm`, { force: true });
  copyFileSync(fil, mål);
  return { brukere: sjekk.brukere, reserve };
}
