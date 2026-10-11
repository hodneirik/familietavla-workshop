import { createHash } from "node:crypto";
import { z } from "zod";
import type { Config } from "../../config.js";
import { audit } from "../../core/audit.js";
import { medNavn, parseIngrediens } from "../../core/ingrediens.js";
import type { AuthUser } from "../../core/auth.js";
import { erDato, leggTilDager, mandagFor, osloDato } from "../../core/dato.js";
import { HttpError } from "../../core/errors.js";
import type { Logger } from "../../core/logger.js";
import type { Db } from "../../db/client.js";
import { normaliser } from "../handleliste/service.js";
import { createHendelse, listKalendere } from "../kalender/service.js";
import { hendelse } from "../kalender/routes.js";
import { createLekser } from "../lekser/service.js";
import { nyLekse } from "../lekser/routes.js";
import { nyPaaminnelse } from "../paaminnelser/routes.js";
import { createPaaminnelser } from "../paaminnelser/service.js";
import { createLapp } from "../oppslag/service.js";
import { nyLapp } from "../oppslag/routes.js";
import { LAPPFARGER } from "../oppslag/service.js";
import { anonymiserTekst, barnAlias } from "./anonymiser.js";
import { KiFeil, type KiKlient } from "./klient.js";
import { krevUnderTak, loggKall, taknivaa, type Forbruk } from "./kostnad.js";
import { byggKontekst, SYSTEMPROMPT } from "./prompt.js";
import { jsonSkjema, KiUkeplanSvar, UKEDAGER_KI, type ValidertForslag } from "./skjema.js";
import { innenPeriode, innenVindu, renTekst, validerSvar } from "./validering.js";

export interface KiDeps {
  config: Config;
  db: Db;
  log: Logger;
  naa: () => number;
  klient: KiKlient | null;
}

/** En feil KI-en selv ga opphav til, med en melding som er trygg å vise. */
export class KiBrukerFeil extends Error {}

// Status

export type Grunn = "avskrudd" | "mangler_nokkel" | "tak_naadd";

export function status(deps: KiDeps) {
  const tak = taknivaa(deps.db, deps.config, deps.naa());
  const grunn: Grunn | undefined =
    deps.config.KI_AKTIV !== "true"
      ? "avskrudd"
      : !deps.klient
        ? "mangler_nokkel"
        : tak.naadd
          ? "tak_naadd"
          : undefined;
  return {
    aktiv: grunn === undefined,
    grunn,
    modell: deps.config.KI_MODELL,
    brukt_ore: tak.brukt_ore,
    tak_ore: tak.tak_ore,
    antall: tak.antall,
  };
}

/** KI skal verken kalles eller svare når den er av. */
export function krevAktiv(deps: KiDeps): KiKlient {
  if (deps.config.KI_AKTIV !== "true" || !deps.klient) {
    throw new HttpError(503, "KI er ikke slått på. Nøkkelen mangler eller KI er skrudd av.");
  }
  return deps.klient;
}

// Innstillinger

interface BarnRad {
  id: number;
  visningsnavn: string;
  klasse: string | null;
}

const aktiveBarn = (db: Db): BarnRad[] =>
  db
    .prepare(
      `SELECT u.id, u.visningsnavn, p.klasse FROM users u LEFT JOIN ki_profil p ON p.barn_id = u.id
       WHERE u.rolle = 'barn' AND u.aktiv = 1 ORDER BY u.id`,
    )
    .all() as unknown as BarnRad[];

export function hentInnstillinger(db: Db) {
  const regler = db
    .prepare(
      "SELECT tekst, standard_kalender_id, voksne, middag_regler FROM ki_regler WHERE id = 1",
    )
    .get() as {
    tekst: string;
    standard_kalender_id: number | null;
    voksne: number;
    middag_regler: string;
  };
  return {
    voksne: regler.voksne,
    barn: aktiveBarn(db).map((b) => ({ id: b.id, navn: b.visningsnavn, klasse: b.klasse })),
    regler: regler.tekst,
    middagRegler: regler.middag_regler,
    standardKalenderId: regler.standard_kalender_id,
    kalendere: listKalendere(db)
      .filter((k) => k.kilde === "manuell")
      .map((k) => ({ id: k.id, navn: k.navn })),
  };
}

/** Hvem som spiser middag: voksne fra innstillingene, og barna fra brukerne. Brukes til mengder og porsjoner. */
/** Reglene for middag. Reglene for ukeplanen (skole, gym, turdager) hører ikke hjemme i middagsforslag. */
export function middagRegler(db: Db): string {
  return (
    db.prepare("SELECT middag_regler FROM ki_regler WHERE id = 1").get() as {
      middag_regler: string;
    }
  ).middag_regler;
}

export function husstand(db: Db): { voksne: number; barn: number } {
  const r = db.prepare("SELECT voksne FROM ki_regler WHERE id = 1").get() as { voksne: number };
  return { voksne: r.voksne, barn: aktiveBarn(db).length };
}

/**
 * Ingrediensnavnene familien allerede bruker, fra rettene og fra handlelisten. Nøkkelen er navnet med små
 * bokstaver, verdien er skrivemåten. Når KI-en bruker samme skrivemåte, slås samme vare sammen på handlelisten.
 */
export function kjenteIngredienser(db: Db): Map<string, string> {
  const ut = new Map<string, string>();
  const ta = (navn: string) => {
    const norm = normaliser(navn);
    if (norm && !ut.has(norm)) ut.set(norm, navn.trim().replace(/\s+/g, " "));
  };
  for (const r of db.prepare("SELECT ingredienser FROM retter ORDER BY id").all() as {
    ingredienser: string;
  }[]) {
    for (const linje of JSON.parse(r.ingredienser) as string[]) ta(parseIngrediens(linje).navn);
  }
  for (const k of db
    .prepare("SELECT navn FROM kjente_varer ORDER BY antall_kjopt DESC LIMIT 200")
    .all() as {
    navn: string;
  }[]) {
    ta(k.navn);
  }
  return ut;
}

/** Bytter ingrediensnavnet til skrivemåten familien bruker fra før, og beholder mengden. */
export function medKjentNavn(linje: string, kjente: Map<string, string>): string {
  const i = parseIngrediens(linje);
  const kjent = kjente.get(normaliser(i.navn));
  return kjent ? medNavn(i, kjent) : linje;
}

export const Innstillinger = z.object({
  barn: z
    .array(
      z.object({
        barnId: z.number().int().positive(),
        klasse: z
          .string()
          .trim()
          .regex(/^(?:[1-9]|10)[A-Za-zÆØÅæøå]?$/, "Skriv klassen som for eksempel 5A")
          .nullable(),
      }),
    )
    .max(12),
  regler: z.string().trim().max(2000),
  /** Faste regler for middag, for eksempel «ingen sopp». Mangler det, beholdes det som står. */
  middagRegler: z.string().trim().max(1000).optional(),
  standardKalenderId: z.number().int().positive().nullable(),
  /** Voksne som spiser middag. Mangler det, beholdes det som står. */
  voksne: z.number().int().min(1).max(8).optional(),
});

export function lagreInnstillinger(db: Db, bruker: AuthUser, data: z.infer<typeof Innstillinger>) {
  const barn = new Set(aktiveBarn(db).map((b) => b.id));
  if (data.barn.some((b) => !barn.has(b.barnId))) {
    throw new HttpError(400, "Klassen må gjelde et barn");
  }
  if (data.standardKalenderId !== null) {
    const k = listKalendere(db).find((x) => x.id === data.standardKalenderId);
    if (!k || k.kilde !== "manuell") throw new HttpError(400, "Velg en kalender som kan endres");
  }
  const tid = new Date().toISOString();
  for (const b of data.barn) {
    if (b.klasse === null) {
      db.prepare("DELETE FROM ki_profil WHERE barn_id = ?").run(b.barnId);
    } else {
      db.prepare(
        `INSERT INTO ki_profil (barn_id, klasse, oppdatert, oppdatert_av) VALUES (?, ?, ?, ?)
         ON CONFLICT (barn_id) DO UPDATE SET klasse = excluded.klasse, oppdatert = excluded.oppdatert,
           oppdatert_av = excluded.oppdatert_av`,
      ).run(b.barnId, b.klasse.toUpperCase(), tid, bruker.id);
    }
  }
  db.prepare(
    "UPDATE ki_regler SET tekst = ?, standard_kalender_id = ?, voksne = COALESCE(?, voksne), middag_regler = COALESCE(?, middag_regler), oppdatert = ?, oppdatert_av = ? WHERE id = 1",
  ).run(
    data.regler,
    data.standardKalenderId,
    data.voksne ?? null,
    data.middagRegler ?? null,
    tid,
    bruker.id,
  );
  audit(db, bruker.id, "ki_innstillinger_endret", { barn: data.barn.length });
  return hentInnstillinger(db);
}

// Analyse

export const Analyser = z.object({
  pdfBase64: z.string().min(100),
  ukeStart: z.string().max(10),
  barnIder: z.array(z.number().int().positive()).min(1).max(10),
  svar: z
    .array(
      z.object({
        spoersmaalId: z.string().max(40),
        spoersmaal: z.string().max(200),
        svar: z.string().max(200),
      }),
    )
    .max(12)
    .default([]),
  bekreftDuplikat: z.boolean().default(false),
});
export type AnalyserInn = z.infer<typeof Analyser>;

export interface AnalyseResultat {
  forslag: ValidertForslag;
  kontrollsum: string;
  kostnad_ore: number;
  brukt_ore: number;
  tak_ore: number;
}

const UKEDAGER = ["søndag", "mandag", "tirsdag", "onsdag", "torsdag", "fredag", "lørdag"];
const ukedag = (dato: string) => UKEDAGER[new Date(`${dato}T12:00:00Z`).getUTCDay()]!;

/** Sjekker alt som kan sjekkes uten å bruke penger. Returnerer PDF-ens kontrollsum. */
export function forberedAnalyse(deps: KiDeps, data: AnalyserInn): string {
  const idag = osloDato(deps.naa());
  if (!erDato(data.ukeStart) || data.ukeStart !== mandagFor(data.ukeStart)) {
    throw new HttpError(400, "Uka må starte på en mandag");
  }
  if (data.ukeStart < leggTilDager(idag, -14) || data.ukeStart > leggTilDager(idag, 14)) {
    throw new HttpError(400, "Uka må ligge innen to uker fra i dag");
  }
  const maksBytes = deps.config.KI_MAKS_PDF_MB * 1024 * 1024;
  if (data.pdfBase64.length > maksBytes * 1.4 || !/^[A-Za-z0-9+/=\s]+$/.test(data.pdfBase64)) {
    throw new HttpError(413, `PDF-en er for stor. Høyst ${deps.config.KI_MAKS_PDF_MB} MB.`);
  }
  const bytes = Buffer.from(data.pdfBase64, "base64");
  if (bytes.length > maksBytes) {
    throw new HttpError(413, `PDF-en er for stor. Høyst ${deps.config.KI_MAKS_PDF_MB} MB.`);
  }
  if (bytes.subarray(0, 5).toString("latin1") !== "%PDF-") {
    throw new HttpError(422, "Filen er ikke en PDF.");
  }
  const barn = new Set(aktiveBarn(deps.db).map((b) => b.id));
  if (data.barnIder.some((id) => !barn.has(id))) throw new HttpError(400, "Velg barn i familien");
  return createHash("sha256").update(bytes).digest("hex");
}

export function finnDuplikat(db: Db, kontrollsum: string) {
  const rad = db
    .prepare(
      `SELECT p.innlagt, u.visningsnavn AS av FROM ki_planer p LEFT JOIN users u ON u.id = p.innlagt_av
       WHERE p.kontrollsum = ? ORDER BY p.id DESC LIMIT 1`,
    )
    .get(kontrollsum) as { innlagt: string; av: string | null } | undefined;
  return rad ? { innlagt: rad.innlagt, av: rad.av } : null;
}

const KI_STATUS = { refusal: "refusal", max_tokens: "max_tokens" } as const;
const NULL_FORBRUK: Forbruk = {
  inputTokens: 0,
  cacheSkrivTokens: 0,
  cacheLesTokens: 0,
  outputTokens: 0,
};

/** Kjører selve analysen. Skriver ingenting til lekser, kalender eller oppslagstavle. */
export async function kjorAnalyse(
  deps: KiDeps,
  bruker: AuthUser,
  data: AnalyserInn,
  kontrollsum: string,
): Promise<AnalyseResultat> {
  const klient = krevAktiv(deps);
  const { db, config } = deps;
  const naa = deps.naa();
  const idag = osloDato(naa);

  const valgte = aktiveBarn(db).filter((b) => data.barnIder.includes(b.id));
  // Aliasene gjelder alle barna, så «barn A» betyr det samme i regler og svar uansett hvilke barn som er valgt
  const alias = barnAlias(aktiveBarn(db));
  const aliasTilBarn = new Map(
    valgte.map((b) => [alias.get(b.id)!, { id: b.id, navn: b.visningsnavn }]),
  );
  const personer = (
    db.prepare("SELECT id, visningsnavn, rolle FROM users WHERE aktiv = 1").all() as {
      id: number;
      visningsnavn: string;
      rolle: string;
    }[]
  ).map((p) => ({ ...p }));

  const innst = hentInnstillinger(db);
  const kalendere = innst.kalendere.map((k, i) => ({ alias: `K${i + 1}`, id: k.id, navn: k.navn }));
  const kalenderAlias = new Map(kalendere.map((k) => [k.alias, k.id]));
  const standard = kalendere.find((k) => k.id === innst.standardKalenderId) ?? null;

  const eksisterende = (
    db
      .prepare(
        `SELECT barn_id, fag, tittel, frist FROM lekser
         WHERE barn_id IN (${valgte.map(() => "?").join(",")}) AND frist BETWEEN ? AND ? ORDER BY frist LIMIT 60`,
      )
      .all(
        ...valgte.map((b) => b.id),
        leggTilDager(data.ukeStart, -14),
        leggTilDager(data.ukeStart, 20),
      ) as {
      barn_id: number;
      fag: string | null;
      tittel: string;
      frist: string;
    }[]
  ).map((l) => ({
    alias: alias.get(l.barn_id) ?? "?",
    fag: l.fag,
    tittel: l.tittel,
    frist: l.frist,
  }));

  const paaminnelseRader = db
    .prepare(
      `SELECT barn_id, ukedag, dato, fra, til, tittel FROM paaminnelser WHERE barn_id IN (${valgte.map(() => "?").join(",")}) ORDER BY ukedag, id LIMIT 60`,
    )
    .all(...valgte.map((b) => b.id)) as {
    barn_id: number;
    ukedag: number | null;
    dato: string | null;
    fra: string | null;
    til: string | null;
    tittel: string;
  }[];
  const eksisterendePaaminnelser = new Set(
    paaminnelseRader.map(
      (p) =>
        `${p.barn_id}|${p.ukedag ?? ""}|${p.dato ?? ""}|${p.fra ?? ""}|${p.til ?? ""}|${p.tittel.toLowerCase()}`,
    ),
  );

  const kontekst = byggKontekst({
    idag,
    ukedag: ukedag(idag),
    ukeStart: data.ukeStart,
    barn: valgte.map((b) => ({
      alias: alias.get(b.id)!,
      klasse: b.klasse,
      trinn: b.klasse ? (/^\d+/.exec(b.klasse)?.[0] ?? null) : null,
    })),
    kalendere: kalendere.map((k) => ({
      alias: k.alias,
      // Navn på kalendere kan inneholde barnas navn
      navn: anonymiserTekst(k.navn, personer, alias),
    })),
    standardKalender: standard?.alias ?? null,
    eksisterende: eksisterende.map((l) => ({
      ...l,
      tittel: anonymiserTekst(l.tittel, personer, alias),
    })),
    eksisterendePaaminnelser: paaminnelseRader.map((p) => ({
      alias: alias.get(p.barn_id) ?? "?",
      ukedag: p.ukedag === null ? null : (UKEDAGER_KI[p.ukedag] ?? null),
      dato: p.dato,
      fra: p.fra,
      til: p.til,
      tittel: anonymiserTekst(p.tittel, personer, alias),
    })),
    regler: anonymiserTekst(innst.regler, personer, alias),
    svar: data.svar.map((s) => ({
      ...s,
      spoersmaal: anonymiserTekst(s.spoersmaal, personer, alias),
      svar: anonymiserTekst(s.svar, personer, alias),
    })),
  });

  const start = Date.now();
  let resultat;
  try {
    resultat = await klient.kjor({
      modell: config.KI_MODELL,
      system: SYSTEMPROMPT,
      pdfBase64: data.pdfBase64,
      kontekst,
      jsonSkjema: jsonSkjema(KiUkeplanSvar),
      effort: "medium",
      fallback: config.KI_FALLBACK === "true",
    });
  } catch (err) {
    loggKall(db, {
      naa: deps.naa(),
      brukerId: bruker.id,
      formaal: "ukeplan",
      modell: config.KI_MODELL,
      forbruk: NULL_FORBRUK,
      kurs: config.KI_USD_NOK,
      status: "feil",
      varighetMs: Date.now() - start,
    });
    throw err;
  }

  const logg = (statusKode: "ok" | "refusal" | "max_tokens" | "ugyldig_svar") =>
    loggKall(db, {
      naa: deps.naa(),
      brukerId: bruker.id,
      formaal: "ukeplan",
      modell: resultat.modell || config.KI_MODELL,
      forbruk: resultat.forbruk,
      kurs: config.KI_USD_NOK,
      status: statusKode,
      requestId: resultat.requestId,
      varighetMs: Date.now() - start,
    });

  if (resultat.stopReason && resultat.stopReason in KI_STATUS) {
    logg(KI_STATUS[resultat.stopReason as keyof typeof KI_STATUS]);
    throw new KiBrukerFeil(
      resultat.stopReason === "refusal"
        ? "KI kunne ikke behandle denne PDF-en."
        : "Planen ble for stor for KI-en å svare på.",
    );
  }

  let rå;
  try {
    // Eldre svar og enkle svar uten påminnelser tåles: feltet er da tomt
    rå = KiUkeplanSvar.safeParse({ paaminnelser: [], ...JSON.parse(resultat.tekst ?? "") });
  } catch {
    rå = null;
  }
  if (!rå?.success) {
    logg("ugyldig_svar");
    throw new KiBrukerFeil("KI-en ga et svar som ikke kunne brukes. Prøv igjen.");
  }

  const forslag = validerSvar(rå.data, {
    ukeStart: data.ukeStart,
    idag,
    aliasTilBarn,
    kalenderAlias,
    standardKalenderId: standard?.id ?? null,
    eksisterendePaaminnelser,
  });
  // Samme uke lagt inn før med en annen PDF: et mykt varsel
  const tidligere = db
    .prepare(
      "SELECT innlagt FROM ki_planer WHERE formaal = 'ukeplan' AND uke_start = ? AND kontrollsum <> ? LIMIT 1",
    )
    .get(data.ukeStart, kontrollsum) as { innlagt: string } | undefined;
  if (tidligere) {
    forslag.advarsler.push(
      "Det er allerede lagt inn en annen plan for denne uka. Kontroller at du ikke får dubletter.",
    );
  }

  const kostnad = logg("ok");
  const tak = taknivaa(db, config, deps.naa());
  audit(db, bruker.id, "ki_analyse", {
    uke: data.ukeStart,
    kostnad_ore: kostnad,
    lekser: forslag.lekser.length,
    avtaler: forslag.avtaler.length,
    paaminnelser: forslag.paaminnelser.length,
    lapper: forslag.lapper.length,
    spoersmaal: forslag.spoersmaal.length,
  });
  return {
    forslag,
    kontrollsum,
    kostnad_ore: kostnad,
    brukt_ore: tak.brukt_ore,
    tak_ore: tak.tak_ore,
  };
}

/** Meldingen til brukeren når en jobb feiler. Aldri innholdet i en intern feil. */
export function jobbFeilmelding(deps: KiDeps, err: unknown): string {
  if (err instanceof KiBrukerFeil || err instanceof KiFeil || err instanceof HttpError)
    return err.message;
  deps.log.error("KI: uventet feil i analysen", {
    feil: err instanceof Error ? err.message : "ukjent",
  });
  return "Noe gikk galt med analysen. Prøv igjen.";
}

export { krevUnderTak };

// Legg inn

const tekstOrNull = (maks: number) => z.string().max(maks).nullish();

export const LeggInn = z.object({
  ukeStart: z.string().max(10),
  kontrollsum: z.string().regex(/^[0-9a-f]{64}$/),
  lekser: z
    .array(
      z.object({
        forslagId: z.string().max(10).optional(),
        barnIder: z.array(z.number().int().positive()).min(1).max(10),
        tittel: z.string().max(500),
        fag: tekstOrNull(200),
        fritekst: tekstOrNull(5000),
        frist: z.string().max(10),
      }),
    )
    .max(30),
  avtaler: z
    .array(
      z.object({
        forslagId: z.string().max(10).optional(),
        kalenderId: z.number().int().positive(),
        tittel: z.string().max(500),
        sted: tekstOrNull(500),
        helDag: z.boolean(),
        start: z.string().max(16),
        slutt: z.string().max(16).nullish(),
        gjentas: z.literal("ukentlig").nullish(),
        gjentasTil: z.string().max(10).nullish(),
      }),
    )
    .max(40),
  paaminnelser: z
    .array(
      z.object({
        forslagId: z.string().max(10).optional(),
        barnIder: z.array(z.number().int().positive()).min(1).max(10),
        tittel: z.string().max(500),
        ukedag: z.number().int().min(0).max(6).nullish(),
        dato: z.string().max(10).nullish(),
        fra: z.string().max(10).nullish(),
        til: z.string().max(10).nullish(),
      }),
    )
    .max(20)
    .default([]),
  lapper: z
    .array(
      z.object({
        forslagId: z.string().max(10).optional(),
        tekst: z.string().max(2000),
        farge: z.enum(LAPPFARGER),
      }),
    )
    .max(8),
});
export type LeggInnInn = z.infer<typeof LeggInn>;

export interface RadResultat {
  forslagId: string;
  type: "lekse" | "avtale" | "paaminnelse" | "lapp";
  ok: boolean;
  feil?: string;
}

/**
 * Lagrer det forelderen har godkjent, ett element om gangen gjennom de vanlige tjenestene. Alt valideres på nytt,
 * for det klienten sender er like lite å stole på som svaret fra KI-en.
 */
export function leggInn(deps: KiDeps, bruker: AuthUser, data: LeggInnInn) {
  const { db } = deps;
  if (!erDato(data.ukeStart) || data.ukeStart !== mandagFor(data.ukeStart)) {
    throw new HttpError(400, "Uka må starte på en mandag");
  }
  const rader: RadResultat[] = [];
  const ider = {
    lekser: [] as number[],
    hendelser: [] as number[],
    paaminnelser: [] as number[],
    lapper: [] as number[],
  };
  const barnIder = new Set<number>();

  const prov = (
    forslagId: string | undefined,
    type: RadResultat["type"],
    n: number,
    jobb: () => void,
  ) => {
    const id = forslagId ?? `${type[0]}${n}`;
    try {
      jobb();
      rader.push({ forslagId: id, type, ok: true });
    } catch (err) {
      const feil =
        err instanceof HttpError || err instanceof z.ZodError
          ? err instanceof z.ZodError
            ? "Ugyldige opplysninger"
            : err.message
          : "Kunne ikke lagres";
      if (!(err instanceof HttpError) && !(err instanceof z.ZodError)) {
        deps.log.error("KI: legg inn feilet", {
          feil: err instanceof Error ? err.message : "ukjent",
        });
      }
      rader.push({ forslagId: id, type, ok: false, feil });
    }
  };
  const krevTekst = (s: string | null | undefined, maks: number, felt: string): string => {
    const t = renTekst(s, maks);
    if (!t) throw new HttpError(400, `${felt} er tom eller har en lenke`);
    return t;
  };
  const valgfri = (s: string | null | undefined, maks: number): string | null => renTekst(s, maks);

  data.lekser.forEach((l, i) =>
    prov(l.forslagId, "lekse", i + 1, () => {
      if (!innenVindu(l.frist, data.ukeStart))
        throw new HttpError(400, "Fristen ligger for langt fra uka");
      const ren = nyLekse.parse({
        barnIder: l.barnIder,
        tittel: krevTekst(l.tittel, 120, "Tittelen"),
        fag: valgfri(l.fag, 40),
        fritekst: valgfri(l.fritekst, 1000),
        frist: l.frist,
      });
      for (const lekse of createLekser(db, bruker, ren)) {
        ider.lekser.push(lekse.id);
        barnIder.add(lekse.barn.id);
      }
    }),
  );
  data.avtaler.forEach((a, i) =>
    prov(a.forslagId, "avtale", i + 1, () => {
      if (!innenVindu(a.start.slice(0, 10), data.ukeStart)) {
        throw new HttpError(400, "Avtalen ligger for langt fra uka");
      }
      const ren = hendelse.parse({
        kalenderId: a.kalenderId,
        tittel: krevTekst(a.tittel, 80, "Tittelen"),
        sted: valgfri(a.sted, 80),
        helDag: a.helDag,
        start: a.start,
        slutt: a.slutt,
        gjentas: a.gjentas,
        gjentasTil: a.gjentas ? a.gjentasTil : null,
      });
      ider.hendelser.push(createHendelse(db, bruker, ren).id);
    }),
  );
  data.paaminnelser.forEach((p, i) =>
    prov(p.forslagId, "paaminnelse", i + 1, () => {
      const enkeltdag = !!p.dato;
      const utenfor = enkeltdag
        ? !innenVindu(p.dato!, data.ukeStart)
        : (p.fra && !innenPeriode(p.fra, data.ukeStart)) ||
          (p.til && !innenPeriode(p.til, data.ukeStart));
      if (utenfor) throw new HttpError(400, "Datoen ligger for langt fra uka");
      const ren = nyPaaminnelse.parse({
        barnIder: p.barnIder,
        tittel: krevTekst(p.tittel, 60, "Tittelen"),
        ...(enkeltdag
          ? { dato: p.dato }
          : { ukedager: [p.ukedag ?? -1], fra: p.fra ?? null, til: p.til ?? null }),
      });
      for (const pm of createPaaminnelser(db, bruker, ren, deps.naa())) {
        if (!ider.paaminnelser.includes(pm.id)) ider.paaminnelser.push(pm.id);
        barnIder.add(pm.barn.id);
      }
    }),
  );
  data.lapper.forEach((l, i) =>
    prov(l.forslagId, "lapp", i + 1, () => {
      const ren = nyLapp.parse({ tekst: krevTekst(l.tekst, 280, "Lappen"), farge: l.farge });
      ider.lapper.push(createLapp(db, bruker, ren).id);
    }),
  );

  const antallOk = rader.filter((r) => r.ok).length;
  if (antallOk > 0) {
    db.prepare(
      `INSERT INTO ki_planer (formaal, uke_start, kontrollsum, innlagt, innlagt_av, barn_ider, antall_lekser,
         antall_avtaler, antall_lapper, ider_json) VALUES ('ukeplan', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      data.ukeStart,
      data.kontrollsum,
      new Date(deps.naa()).toISOString(),
      bruker.id,
      JSON.stringify([...barnIder]),
      ider.lekser.length,
      ider.hendelser.length,
      ider.lapper.length,
      JSON.stringify(ider),
    );
    audit(db, bruker.id, "ki_ukeplan_innlagt", {
      uke: data.ukeStart,
      lekser: ider.lekser.length,
      avtaler: ider.hendelser.length,
      paaminnelser: ider.paaminnelser.length,
      lapper: ider.lapper.length,
    });
  }
  return { rader, antallOk };
}
