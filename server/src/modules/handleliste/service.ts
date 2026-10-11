import { STANDARD_PROFILFARGE } from "../../core/profilfarger.js";
import { audit } from "../../core/audit.js";
import type { AuthUser } from "../../core/auth.js";
import { HttpError } from "../../core/errors.js";
import { norskDato } from "../../core/dato.js";
import { summerMengder } from "../../core/ingrediens.js";
import { iTransaksjon } from "../../core/transaksjon.js";
import type { Db } from "../../db/client.js";

const MAKS_PA_LISTA = 300;
const VIS_HANDLET_TIMER = 48;
const SLETT_HANDLET_DAGER = 30;
const MAKS_FORSLAG = 8;

interface Rad {
  id: number;
  navn: string;
  notat: string | null;
  kjopt: number;
  opprettet: string;
  kjopt_tid: string | null;
  av_id: number | null;
  av_navn: string | null;
  av_farge: string | null;
  av_emoji: string | null;
}

export interface Vare {
  id: number;
  navn: string;
  /** Notatet som vises i grå skrift: eget notat, og når varen må handles innen for middagene den er til. */
  notat: string | null;
  /** Bare det man selv har skrevet. Det er dette som kan endres. */
  egetNotat: string | null;
  /** Hvor mye som trengs til middagene, lagt sammen («600 g», «2 stk + 1 pk»). Tom hvis ingen har oppgitt mengde. */
  mengde: string | null;
  kjopt: boolean;
  opprettet: string;
  kjoptTid: string | null;
  lagtTilAv: { id: number; visningsnavn: string; farge: string; emoji: string | null } | null;
}

/** Små bokstaver og ett mellomrom mellom ordene, slik at «Melk», «melk» og « MELK  » er samme vare. */
export function normaliser(navn: string): string {
  return navn.trim().replace(/\s+/g, " ").toLocaleLowerCase("nb-NO");
}

const SELECT = `
  SELECT h.id, h.navn, h.notat, h.kjopt, h.opprettet, h.kjopt_tid,
         u.id AS av_id, u.visningsnavn AS av_navn, u.farge AS av_farge, u.emoji AS av_emoji
  FROM handleliste h LEFT JOIN users u ON u.id = h.lagt_til_av`;

function tilVare(r: Rad, middagslinjer: string[], mengde: string | null): Vare {
  return {
    id: r.id,
    navn: r.navn,
    notat: [r.notat, ...middagslinjer].filter(Boolean).join("\n") || null,
    egetNotat: r.notat,
    mengde,
    kjopt: r.kjopt === 1,
    opprettet: r.opprettet,
    kjoptTid: r.kjopt_tid,
    lagtTilAv:
      r.av_id === null
        ? null
        : {
            id: r.av_id,
            visningsnavn: r.av_navn ?? "",
            farge: r.av_farge ?? STANDARD_PROFILFARGE,
            emoji: r.av_emoji,
          },
  };
}

/** «fre 9. okt.»: kort nok til å stå under varen på handlelisten. */
const kortDag = (dato: string) => norskDato(dato).replace(/^(\p{L}{3})\p{L}*/u, "$1");

interface Middagsdel {
  linjer: string[];
  deler: { mengde: number | null; enhet: string | null }[];
}

/** For hver vare: én linje per middag den er lagt til for (med mengde), og mengdene lagt sammen. */
function middagsdeler(db: Db, ider: number[]): Map<number, Middagsdel> {
  const ut = new Map<number, Middagsdel>();
  if (ider.length === 0) return ut;
  const rader = db
    .prepare(
      `SELECT hm.vare_id, m.dato, m.rett, hm.mengde, hm.enhet FROM handleliste_middag hm
       JOIN middag m ON m.dato = hm.dato
       WHERE hm.vare_id IN (${ider.map(() => "?").join(",")}) ORDER BY m.dato`,
    )
    .all(...ider) as {
    vare_id: number;
    dato: string;
    rett: string;
    mengde: number | null;
    enhet: string | null;
  }[];
  for (const r of rader) {
    const del = ut.get(r.vare_id) ?? { linjer: [], deler: [] };
    const hvor = summerMengder([r]);
    del.linjer.push(`Til ${r.rett}${hvor ? ` (${hvor})` : ""} · ${kortDag(r.dato)}`);
    del.deler.push({ mengde: r.mengde, enhet: r.enhet });
    ut.set(r.vare_id, del);
  }
  return ut;
}

function tilVarer(db: Db, rader: Rad[]): Vare[] {
  const deler = middagsdeler(
    db,
    rader.map((r) => r.id),
  );
  return rader.map((r) => {
    const d = deler.get(r.id);
    return tilVare(r, d?.linjer ?? [], d ? summerMengder(d.deler) : null);
  });
}

const enVare = (db: Db, rad: Rad): Vare => tilVarer(db, [rad])[0]!;

function hentRad(db: Db, id: number): Rad {
  const rad = db.prepare(`${SELECT} WHERE h.id = ?`).get(id) as Rad | undefined;
  if (!rad) throw new HttpError(404, "Fant ikke varen");
  return rad;
}

const tidSiden = (timer: number) => new Date(Date.now() - timer * 3_600_000).toISOString();

/** Det som skal handles først, i den rekkefølgen det ble lagt til, og så det som er handlet nylig. */
export function listVarer(db: Db): Vare[] {
  const rader = db
    .prepare(
      `${SELECT} WHERE h.kjopt = 0 OR h.kjopt_tid > ?
       ORDER BY h.kjopt, CASE WHEN h.kjopt = 0 THEN h.id END, h.kjopt_tid DESC`,
    )
    .all(tidSiden(VIS_HANDLET_TIMER)) as unknown as Rad[];
  return tilVarer(db, rader);
}

/** Legger en ny vare på lista. Varen må ikke allerede stå der. Gir id-en. */
function settInn(db: Db, bruker: AuthUser, navn: string, notat: string | null): number {
  const antall = (
    db.prepare("SELECT COUNT(*) AS n FROM handleliste WHERE kjopt = 0").get() as { n: number }
  ).n;
  if (antall >= MAKS_PA_LISTA)
    throw new HttpError(409, "Lista er full. Kryss av eller fjern noe først");

  // Gamle handlede varer ryddes bort av seg selv
  db.prepare("DELETE FROM handleliste WHERE kjopt = 1 AND kjopt_tid < ?").run(
    tidSiden(SLETT_HANDLET_DAGER * 24),
  );

  // Bruker skrivemåten fra tidligere («Melk»), ellers stor forbokstav, så lista ser lik ut hver gang
  const norm = normaliser(navn);
  const kjent = db.prepare("SELECT navn FROM kjente_varer WHERE navn_norm = ?").get(norm) as
    { navn: string } | undefined;
  const rent = navn.trim().replace(/\s+/g, " ");
  const visningsnavn = kjent?.navn ?? rent.charAt(0).toLocaleUpperCase("nb-NO") + rent.slice(1);
  const res = db
    .prepare("INSERT INTO handleliste (navn, navn_norm, notat, lagt_til_av) VALUES (?, ?, ?, ?)")
    .run(visningsnavn, norm, notat, bruker.id);
  const id = Number(res.lastInsertRowid);
  audit(db, bruker.id, "vare_lagt_til", { id });
  return id;
}

const finnPaaLista = (db: Db, navn: string) =>
  db
    .prepare("SELECT id, notat FROM handleliste WHERE kjopt = 0 AND navn_norm = ?")
    .get(normaliser(navn)) as { id: number; notat: string | null } | undefined;

export function createVare(
  db: Db,
  bruker: AuthUser,
  navn: string,
  notat: string | null = null,
): { vare: Vare; fantes: boolean } {
  const paaLista = finnPaaLista(db, navn);
  if (paaLista) {
    // Står varen der fra før uten notat, får den notatet. Ellers lar vi det som står.
    if (notat && !paaLista.notat) {
      db.prepare("UPDATE handleliste SET notat = ? WHERE id = ?").run(notat, paaLista.id);
    }
    return { vare: enVare(db, hentRad(db, paaLista.id)), fantes: true };
  }
  const id = settInn(db, bruker, navn, notat);
  return { vare: enVare(db, hentRad(db, id)), fantes: false };
}

/** Endrer notatet til en vare. Alle kan gjøre det. Tomt notat fjerner det. */
export function oppdaterNotat(db: Db, bruker: AuthUser, id: number, notat: string | null): Vare {
  hentRad(db, id);
  db.prepare("UPDATE handleliste SET notat = ? WHERE id = ?").run(notat || null, id);
  audit(db, bruker.id, "vare_notat_endret", { id });
  return enVare(db, hentRad(db, id));
}

/**
 * Brukes når en middag planlegges: legger ingrediensen på lista, eller bruker den som står der fra før.
 * «ny» er sant hvis varen ble lagt til for denne middagen, og kan da fjernes igjen sammen med den.
 */
export function leggTilFraMiddag(
  db: Db,
  bruker: AuthUser,
  navn: string,
): { id: number; ny: boolean } {
  const paaLista = finnPaaLista(db, navn);
  if (paaLista) return { id: paaLista.id, ny: false };
  return { id: settInn(db, bruker, navn, null), ny: true };
}

/**
 * Tar tilbake det en middag la på lista. Varer som ble lagt til bare for denne middagen og ikke er handlet,
 * fjernes, men ikke hvis noen har skrevet et eget notat eller en annen middag trenger dem også.
 */
export function fjernFraMiddag(db: Db, dato: string): void {
  const koblinger = db
    .prepare(
      `SELECT hm.vare_id, hm.ny, h.kjopt, h.notat FROM handleliste_middag hm
       JOIN handleliste h ON h.id = hm.vare_id WHERE hm.dato = ?`,
    )
    .all(dato) as { vare_id: number; ny: number; kjopt: number; notat: string | null }[];
  for (const k of koblinger) {
    if (k.ny !== 1 || k.kjopt === 1) continue;
    const andre = db
      .prepare("SELECT dato FROM handleliste_middag WHERE vare_id = ? AND dato <> ? ORDER BY dato")
      .all(k.vare_id, dato) as { dato: string }[];
    if (andre.length > 0) {
      // Varen trengs av en annen middag. Den overtar ansvaret for å fjerne den.
      db.prepare("UPDATE handleliste_middag SET ny = 1 WHERE vare_id = ? AND dato = ?").run(
        k.vare_id,
        andre[0]!.dato,
      );
    } else if (!k.notat) {
      db.prepare("DELETE FROM handleliste WHERE id = ?").run(k.vare_id);
    }
  }
  db.prepare("DELETE FROM handleliste_middag WHERE dato = ?").run(dato);
}

/** Kryss av som handlet. Varen blir en «kjent vare» som dukker opp som forslag neste gang. */
export function kjopVare(db: Db, bruker: AuthUser, id: number): Vare {
  const rad = hentRad(db, id);
  if (rad.kjopt === 1) return enVare(db, rad);
  const nå = new Date().toISOString();
  iTransaksjon(db, () => {
    db.prepare("UPDATE handleliste SET kjopt = 1, kjopt_tid = ?, kjopt_av = ? WHERE id = ?").run(
      nå,
      bruker.id,
      id,
    );
    db.prepare(
      `INSERT INTO kjente_varer (navn, navn_norm, antall_kjopt, sist_kjopt) VALUES (?, ?, 1, ?)
       ON CONFLICT (navn_norm) DO UPDATE SET antall_kjopt = antall_kjopt + 1, sist_kjopt = excluded.sist_kjopt, navn = excluded.navn`,
    ).run(rad.navn, normaliser(rad.navn), nå);
  });
  return enVare(db, hentRad(db, id));
}

/** Angre en avkrysning, og trekk tilbake tellingen i de kjente varene. */
export function angreKjop(db: Db, _bruker: AuthUser, id: number): Vare {
  const rad = hentRad(db, id);
  if (rad.kjopt === 0) return enVare(db, rad);
  const norm = normaliser(rad.navn);
  iTransaksjon(db, () => {
    db.prepare(
      "UPDATE handleliste SET kjopt = 0, kjopt_tid = NULL, kjopt_av = NULL WHERE id = ?",
    ).run(id);
    db.prepare("UPDATE kjente_varer SET antall_kjopt = antall_kjopt - 1 WHERE navn_norm = ?").run(
      norm,
    );
    db.prepare("DELETE FROM kjente_varer WHERE navn_norm = ? AND antall_kjopt <= 0").run(norm);
  });
  return enVare(db, hentRad(db, id));
}

function kreverForelder(bruker: AuthUser): void {
  if (bruker.rolle !== "forelder") throw new HttpError(403, "Bare foreldre kan fjerne varer");
}

export function deleteVare(db: Db, bruker: AuthUser, id: number): void {
  kreverForelder(bruker);
  hentRad(db, id);
  db.prepare("DELETE FROM handleliste WHERE id = ?").run(id);
  audit(db, bruker.id, "vare_slettet", { id });
}

/** Fjerner alt som er krysset av. Antall varer fjernet kommer tilbake. */
export function fjernHandlede(db: Db, bruker: AuthUser): number {
  kreverForelder(bruker);
  const res = db.prepare("DELETE FROM handleliste WHERE kjopt = 1").run();
  const antall = Number(res.changes);
  audit(db, bruker.id, "handlede_fjernet", { antall });
  return antall;
}

/**
 * Varer som er handlet før og som passer med det som er skrevet, uten dem som allerede står på lista.
 * Eksakt treff kommer først, så treff på begynnelsen av navnet, så treff midt i navnet. Det man handler oftest, kommer høyest.
 * Uten tekst får man de mest handlede.
 */
export function forslag(db: Db, tekst: string): string[] {
  const q = normaliser(tekst);
  const escaped = q.replace(/[\\%_]/g, (c) => `\\${c}`);
  const rader = db
    .prepare(
      `SELECT k.navn FROM kjente_varer k
       WHERE (? = '' OR k.navn_norm LIKE ? ESCAPE '\\')
         AND NOT EXISTS (SELECT 1 FROM handleliste h WHERE h.kjopt = 0 AND h.navn_norm = k.navn_norm)
       ORDER BY CASE WHEN ? <> '' AND k.navn_norm = ? THEN 0
                     WHEN ? <> '' AND k.navn_norm LIKE ? ESCAPE '\\' THEN 1
                     ELSE 2 END,
                k.antall_kjopt DESC, k.sist_kjopt DESC, k.navn
       LIMIT ?`,
    )
    .all(q, `%${escaped}%`, q, q, q, `${escaped}%`, MAKS_FORSLAG) as { navn: string }[];
  return rader.map((r) => r.navn);
}
