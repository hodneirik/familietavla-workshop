import { STANDARD_PROFILFARGE } from "../../core/profilfarger.js";
import { audit } from "../../core/audit.js";
import { leggTilDager, mandagFor, nesteMaanedStart, osloDato } from "../../core/dato.js";
import type { AuthUser } from "../../core/auth.js";
import { HttpError } from "../../core/errors.js";
import { iTransaksjon } from "../../core/transaksjon.js";
import type { Db } from "../../db/client.js";

export type Status = "ledig" | "tatt" | "venter" | "godkjent";

/** Hvor ofte et gjøremål kommer tilbake etter at det er godkjent. */
export type Gjentakelse = "daglig" | "ukentlig" | "annenhver_uke" | "maanedlig";

const MAKS_GODKJENTE = 20;
/** Mest en besteforelder kan gi i poeng for et gjøremål. */
export const MAKS_POENG_BESTEFORELDER = 30;

interface Rad {
  id: number;
  tittel: string;
  poeng: number;
  status: Status;
  opprettet: string;
  tatt: string | null;
  fullfort: string | null;
  godkjent: string | null;
  gjentas: Gjentakelse | null;
  ledig_fra: string | null;
  opprettet_av: number | null;
  eier_id: number | null;
  eier_navn: string | null;
  eier_farge: string | null;
  eier_emoji: string | null;
}

export interface Gjoremal {
  id: number;
  tittel: string;
  poeng: number;
  status: Status;
  opprettet: string;
  tatt: string | null;
  fullfort: string | null;
  godkjent: string | null;
  /** Hvor ofte det kommer tilbake etter godkjenning, eller null hvis det bare gjøres én gang. */
  gjentas: Gjentakelse | null;
  /** For gjentakende gjøremål som hviler: datoen det blir ledig igjen (ÅÅÅÅ-MM-DD). */
  ledigFra: string | null;
  /** Hvem som laget gjøremålet. Besteforeldre kan bare endre og godkjenne sine egne. */
  opprettetAv: number | null;
  eier: { id: number; visningsnavn: string; farge: string; emoji: string | null } | null;
}

export interface Poengstatus {
  bruker: { id: number; visningsnavn: string; farge: string; emoji: string | null };
  /** Poeng som er godkjent og er til gode. */
  poeng: number;
  /** Poeng for gjøremål som er meldt ferdige og venter på godkjenning. */
  klare: number;
}

const SELECT = `
  SELECT g.id, g.tittel, g.poeng, g.status, g.opprettet, g.tatt, g.fullfort, g.godkjent, g.gjentas, g.ledig_fra, g.opprettet_av, g.eier_id,
         u.visningsnavn AS eier_navn, u.farge AS eier_farge, u.emoji AS eier_emoji
  FROM gjoremal g LEFT JOIN users u ON u.id = g.eier_id`;

function tilGjoremal(r: Rad): Gjoremal {
  return {
    id: r.id,
    tittel: r.tittel,
    poeng: r.poeng,
    status: r.status,
    opprettet: r.opprettet,
    tatt: r.tatt,
    fullfort: r.fullfort,
    godkjent: r.godkjent,
    gjentas: r.gjentas,
    ledigFra: r.ledig_fra,
    opprettetAv: r.opprettet_av,
    eier:
      r.eier_id === null
        ? null
        : {
            id: r.eier_id,
            visningsnavn: r.eier_navn ?? "",
            farge: r.eier_farge ?? STANDARD_PROFILFARGE,
            emoji: r.eier_emoji,
          },
  };
}

/** Når et gjentakende gjøremål kan gjøres igjen, regnet fra datoen det ble godkjent (norsk tid). */
export function nesteGang(gjentas: Gjentakelse, idag: string): string {
  if (gjentas === "daglig") return leggTilDager(idag, 1);
  if (gjentas === "ukentlig") return leggTilDager(mandagFor(idag), 7);
  // Hopper over en hel uke: mandagen to uker etter mandagen i uka det ble godkjent
  if (gjentas === "annenhver_uke") return leggTilDager(mandagFor(idag), 14);
  return nesteMaanedStart(idag);
}

/** Et gjentakende gjøremål som er godkjent og venter på at neste runde begynner. */
const hviler = (g: Gjoremal, idag: string): boolean =>
  g.status === "ledig" && g.ledigFra !== null && g.ledigFra > idag;

/**
 * Foreldre kan alt. Besteforeldre kan bare endre, slette og godkjenne gjøremål de selv har laget.
 * Barn kan ingenting av dette.
 */
function kreverForelderEllerEier(bruker: AuthUser, g: Gjoremal): void {
  if (bruker.rolle === "forelder") return;
  if (bruker.rolle === "besteforelder" && g.opprettetAv === bruker.id) return;
  throw new HttpError(
    403,
    bruker.rolle === "besteforelder"
      ? "Du kan bare endre og godkjenne gjøremål du selv har laget"
      : "Bare foreldre kan gjøre dette",
  );
}

function kreverPoengTak(bruker: AuthUser, poeng: number): void {
  if (bruker.rolle === "besteforelder" && poeng > MAKS_POENG_BESTEFORELDER) {
    throw new HttpError(400, `Du kan gi høyst ${MAKS_POENG_BESTEFORELDER} poeng`);
  }
}

function kreverBarn(bruker: AuthUser): void {
  if (bruker.rolle !== "barn") throw new HttpError(403, "Bare barn kan ta gjøremål");
}

function hent(db: Db, id: number): Gjoremal {
  const rad = db.prepare(`${SELECT} WHERE g.id = ?`).get(id) as Rad | undefined;
  if (!rad) throw new HttpError(404, "Fant ikke gjøremålet");
  return tilGjoremal(rad);
}

/**
 * Setter nye felt bare hvis gjøremålet fortsatt har forventet status. Hindrer at to som trykker
 * samtidig begge får det, og at to godkjenninger gir poeng to ganger.
 */
function bytt(
  db: Db,
  id: number,
  fra: Status,
  sett: string,
  ...verdier: (string | number | null)[]
) {
  const res = db
    .prepare(`UPDATE gjoremal SET ${sett} WHERE id = ? AND status = ?`)
    .run(...verdier, id, fra);
  if (Number(res.changes) === 0) {
    throw new HttpError(409, "Noen andre rakk det først. Tavla er oppdatert.");
  }
}

/**
 * Åpne gjøremål først (nyeste godkjente sist), og de siste godkjente. Gjentakende gjøremål som hviler
 * til neste runde, vises bare for foreldre, helt nederst blant de åpne.
 */
export function listGjoremal(db: Db, bruker: AuthUser, naa: number): Gjoremal[] {
  const idag = osloDato(naa);
  const aktive = (
    db
      .prepare(
        `${SELECT} WHERE g.status <> 'godkjent'
         ORDER BY CASE g.status WHEN 'venter' THEN 0 WHEN 'tatt' THEN 1 ELSE 2 END, g.id`,
      )
      .all() as unknown as Rad[]
  ).map(tilGjoremal);
  // De som hviler til neste runde, ser bare foreldre, og besteforeldre for sine egne
  const synlige = aktive.filter(
    (g) =>
      !hviler(g, idag) ||
      bruker.rolle === "forelder" ||
      (bruker.rolle === "besteforelder" && g.opprettetAv === bruker.id),
  );
  const ferdige = [
    ...synlige.filter((g) => !hviler(g, idag)),
    ...synlige.filter((g) => hviler(g, idag)),
  ];
  const godkjente = db
    .prepare(`${SELECT} WHERE g.status = 'godkjent' ORDER BY g.godkjent DESC, g.id DESC LIMIT ?`)
    .all(MAKS_GODKJENTE) as unknown as Rad[];
  return [...ferdige, ...godkjente.map(tilGjoremal)];
}

export function createGjoremal(
  db: Db,
  bruker: AuthUser,
  data: { tittel: string; poeng: number; gjentas?: Gjentakelse | null },
): Gjoremal {
  if (bruker.rolle === "barn") throw new HttpError(403, "Bare voksne kan lage gjøremål");
  kreverPoengTak(bruker, data.poeng);
  const res = db
    .prepare("INSERT INTO gjoremal (tittel, poeng, gjentas, opprettet_av) VALUES (?, ?, ?, ?)")
    .run(data.tittel, data.poeng, data.gjentas ?? null, bruker.id);
  const id = Number(res.lastInsertRowid);
  audit(db, bruker.id, "gjoremal_opprettet", {
    id,
    poeng: data.poeng,
    gjentas: data.gjentas ?? null,
  });
  return hent(db, id);
}

export function updateGjoremal(
  db: Db,
  bruker: AuthUser,
  id: number,
  data: { tittel?: string; poeng?: number; gjentas?: Gjentakelse | null },
): Gjoremal {
  const g = hent(db, id);
  kreverForelderEllerEier(bruker, g);
  if (data.poeng !== undefined) kreverPoengTak(bruker, data.poeng);
  if (g.status === "godkjent") throw new HttpError(409, "Godkjente gjøremål kan ikke endres");
  const gjentas = data.gjentas === undefined ? g.gjentas : data.gjentas;
  // Slås gjentakelsen av, er gjøremålet ledig med en gang igjen
  const ledigFra = gjentas === null ? null : g.ledigFra;
  db.prepare(
    "UPDATE gjoremal SET tittel = ?, poeng = ?, gjentas = ?, ledig_fra = ? WHERE id = ?",
  ).run(data.tittel ?? g.tittel, data.poeng ?? g.poeng, gjentas, ledigFra, id);
  audit(db, bruker.id, "gjoremal_endret", { id });
  return hent(db, id);
}

export function deleteGjoremal(db: Db, bruker: AuthUser, id: number): void {
  kreverForelderEllerEier(bruker, hent(db, id));
  db.prepare("DELETE FROM gjoremal WHERE id = ?").run(id);
  audit(db, bruker.id, "gjoremal_slettet", { id });
}

/** Et barn tar et ledig gjøremål. Bare ett barn kan eie det. */
export function taGjoremal(db: Db, bruker: AuthUser, id: number, naa: number): Gjoremal {
  kreverBarn(bruker);
  const g = hent(db, id);
  if (hviler(g, osloDato(naa))) {
    throw new HttpError(409, "Dette gjøremålet kommer ikke tilbake ennå");
  }
  if (g.status !== "ledig") {
    throw new HttpError(
      409,
      g.eier ? `${g.eier.visningsnavn} har allerede tatt dette` : "Gjøremålet er ikke ledig",
    );
  }
  bytt(
    db,
    id,
    "ledig",
    "status = 'tatt', eier_id = ?, tatt = ?",
    bruker.id,
    new Date().toISOString(),
  );
  audit(db, bruker.id, "gjoremal_tatt", { id });
  return hent(db, id);
}

/** Barnet gir fra seg et gjøremål det ikke har meldt ferdig. Forelder kan frigjøre alle. */
export function slippGjoremal(db: Db, bruker: AuthUser, id: number): Gjoremal {
  if (bruker.rolle === "besteforelder") throw new HttpError(403, "Bare foreldre kan frigjøre");
  const g = hent(db, id);
  if (bruker.rolle === "forelder") {
    if (g.status !== "tatt" && g.status !== "venter") {
      throw new HttpError(409, "Gjøremålet har ingen eier å frigjøre");
    }
  } else {
    if (g.eier?.id !== bruker.id) throw new HttpError(403, "Dette er ikke ditt gjøremål");
    if (g.status === "venter") {
      throw new HttpError(409, "Du har meldt det ferdig. Trykk Angre først");
    }
    if (g.status !== "tatt") throw new HttpError(409, "Gjøremålet kan ikke slippes nå");
  }
  bytt(db, id, g.status, "status = 'ledig', eier_id = NULL, tatt = NULL, fullfort = NULL");
  audit(db, bruker.id, "gjoremal_sluppet", { id, eier: g.eier?.id });
  return hent(db, id);
}

/** Barnet melder gjøremålet ferdig. Poengene ligger klare til en forelder godkjenner. */
export function fullforGjoremal(db: Db, bruker: AuthUser, id: number): Gjoremal {
  kreverBarn(bruker);
  const g = hent(db, id);
  if (g.eier?.id !== bruker.id) throw new HttpError(403, "Dette er ikke ditt gjøremål");
  if (g.status !== "tatt") throw new HttpError(409, "Gjøremålet kan ikke meldes ferdig nå");
  bytt(db, id, "tatt", "status = 'venter', fullfort = ?", new Date().toISOString());
  audit(db, bruker.id, "gjoremal_fullfort", { id });
  return hent(db, id);
}

/** Barnet trekker tilbake en «ferdig»-melding som ikke er godkjent ennå. */
export function angreGjoremal(db: Db, bruker: AuthUser, id: number): Gjoremal {
  kreverBarn(bruker);
  const g = hent(db, id);
  if (g.eier?.id !== bruker.id) throw new HttpError(403, "Dette er ikke ditt gjøremål");
  if (g.status !== "venter") throw new HttpError(409, "Det er ingenting å angre");
  bytt(db, id, "venter", "status = 'tatt', fullfort = NULL");
  audit(db, bruker.id, "gjoremal_angret", { id });
  return hent(db, id);
}

/**
 * Forelder godkjenner. Poengene skrives til journalen i samme operasjon. Et gjentakende gjøremål
 * blir stående som godkjent i historikken, og selve gjøremålet hviler til neste runde begynner.
 */
export function godkjennGjoremal(db: Db, bruker: AuthUser, id: number, naa: number): Gjoremal {
  const g = hent(db, id);
  kreverForelderEllerEier(bruker, g);
  if (g.status !== "venter" || !g.eier) {
    throw new HttpError(409, "Gjøremålet venter ikke på godkjenning");
  }
  const eier = g.eier;
  const godkjentTid = new Date(naa).toISOString();
  let svar = id;
  iTransaksjon(db, () => {
    let poengId = id;
    if (g.gjentas) {
      // Historikken får en egen godkjent kopi, og originalen går tilbake til ledig
      const kopi = db
        .prepare(
          `INSERT INTO gjoremal (tittel, poeng, status, eier_id, opprettet_av, tatt, fullfort, godkjent, godkjent_av)
           SELECT tittel, poeng, 'godkjent', eier_id, opprettet_av, tatt, fullfort, ?, ? FROM gjoremal WHERE id = ?`,
        )
        .run(godkjentTid, bruker.id, id);
      poengId = Number(kopi.lastInsertRowid);
      svar = poengId;
      bytt(
        db,
        id,
        "venter",
        "status = 'ledig', eier_id = NULL, tatt = NULL, fullfort = NULL, ledig_fra = ?",
        nesteGang(g.gjentas, osloDato(naa)),
      );
    } else {
      bytt(
        db,
        id,
        "venter",
        "status = 'godkjent', godkjent = ?, godkjent_av = ?",
        godkjentTid,
        bruker.id,
      );
    }
    if (g.poeng > 0) {
      db.prepare(
        "INSERT INTO poeng_logg (user_id, poeng, grunn, gjoremal_id) VALUES (?, ?, ?, ?)",
      ).run(eier.id, g.poeng, g.tittel, poengId);
    }
  });
  audit(db, bruker.id, "gjoremal_godkjent", {
    id,
    barn: eier.id,
    poeng: g.poeng,
    gjentas: g.gjentas,
  });
  return hent(db, svar);
}

/** Forelder sier at det ikke er ferdig. Barnet beholder gjøremålet og kan melde det ferdig igjen. */
export function avvisGjoremal(db: Db, bruker: AuthUser, id: number): Gjoremal {
  const g = hent(db, id);
  kreverForelderEllerEier(bruker, g);
  if (g.status !== "venter") throw new HttpError(409, "Gjøremålet venter ikke på godkjenning");
  bytt(db, id, "venter", "status = 'tatt', fullfort = NULL");
  audit(db, bruker.id, "gjoremal_avvist", { id, barn: g.eier?.id });
  return hent(db, id);
}

/** Barn ser bare sin egen saldo. Voksne ser alle barna. */
export function poengStatus(db: Db, bruker: AuthUser): Poengstatus[] {
  const barn =
    bruker.rolle !== "barn"
      ? (db
          .prepare(
            "SELECT id, visningsnavn, farge, emoji FROM users WHERE rolle = 'barn' AND aktiv = 1 ORDER BY visningsnavn",
          )
          .all() as unknown as Poengstatus["bruker"][])
      : [
          {
            id: bruker.id,
            visningsnavn: bruker.visningsnavn,
            farge: bruker.farge,
            emoji: bruker.emoji,
          },
        ];
  const sumPoeng = db.prepare(
    "SELECT COALESCE(SUM(poeng), 0) AS n FROM poeng_logg WHERE user_id = ?",
  );
  const sumKlare = db.prepare(
    "SELECT COALESCE(SUM(poeng), 0) AS n FROM gjoremal WHERE eier_id = ? AND status = 'venter'",
  );
  return barn.map((b) => ({
    bruker: b,
    poeng: (sumPoeng.get(b.id) as { n: number }).n,
    klare: (sumKlare.get(b.id) as { n: number }).n,
  }));
}
