import type { Config } from "../../config.js";
import { osloDato } from "../../core/dato.js";
import { HttpError } from "../../core/errors.js";
import type { Db } from "../../db/client.js";

/** Dollar per million tokens. Tokens ganger dollar per million er dermed mikrodollar. */
interface Pris {
  inn: number;
  ut: number;
  cacheLes: number;
  cacheSkriv: number;
}

export const PRISER: Record<string, Pris> = {
  "claude-sonnet-5-5": { inn: 2, ut: 10, cacheLes: 0.2, cacheSkriv: 2.5 },
  "claude-opus-5-5": { inn: 4, ut: 20, cacheLes: 0.2, cacheSkriv: 5 },
  "claude-haiku-5-5": { inn: 0.1, ut: 0.5, cacheLes: 0.01, cacheSkriv: 0.125 },
};

/** Ukjent modell regnes med den høyeste prisen, så taket aldri undervurderer kostnaden. */
const HOYESTE: Pris = { inn: 10, ut: 50, cacheLes: 1, cacheSkriv: 12.5 };

export interface Forbruk {
  inputTokens: number;
  cacheSkrivTokens: number;
  cacheLesTokens: number;
  outputTokens: number;
}

export const prisFor = (modell: string): { pris: Pris; kjent: boolean } => {
  const pris = PRISER[modell];
  return pris ? { pris, kjent: true } : { pris: HOYESTE, kjent: false };
};

/** Kostnaden i mikrodollar, avrundet opp. `input` er tokens utenom cache. */
export function kostnadMikroUsd(forbruk: Forbruk, modell: string): number {
  const { pris } = prisFor(modell);
  return Math.ceil(
    forbruk.inputTokens * pris.inn +
      forbruk.cacheSkrivTokens * pris.cacheSkriv +
      forbruk.cacheLesTokens * pris.cacheLes +
      forbruk.outputTokens * pris.ut,
  );
}

/** Mikrodollar til øre, avrundet opp. */
export const mikroUsdTilOre = (mikroUsd: number, kurs: number): number =>
  Math.ceil((mikroUsd * kurs) / 10_000);

/** «ÅÅÅÅ-MM» i norsk tid. */
export const maanedFor = (naa: number): string => osloDato(naa).slice(0, 7);

export function brukt(db: Db, maaned: string): { ore: number; antall: number } {
  const rad = db
    .prepare(
      "SELECT COALESCE(SUM(kostnad_ore), 0) AS ore, COUNT(*) AS antall FROM ki_logg WHERE maaned = ?",
    )
    .get(maaned) as { ore: number; antall: number };
  return rad;
}

export interface Taknivaa {
  tak_ore: number;
  brukt_ore: number;
  antall: number;
  naadd: boolean;
}

/** Taket regnes mot det som er brukt i måneden pluss reserven, så overskridelsen blir høyst ett kall. */
export function taknivaa(db: Db, config: Config, naa: number): Taknivaa {
  const tak_ore = Math.round(config.KI_MAANEDSTAK_NOK * 100);
  const { ore, antall } = brukt(db, maanedFor(naa));
  const reserve = Math.round(config.KI_RESERVE_NOK * 100);
  return { tak_ore, brukt_ore: ore, antall, naadd: ore + reserve >= tak_ore };
}

export function krevUnderTak(db: Db, config: Config, naa: number): void {
  if (taknivaa(db, config, naa).naadd) {
    throw new HttpError(
      429,
      `Månedstaket på ${config.KI_MAANEDSTAK_NOK} kr for KI er nådd. Det nullstilles første dag i neste måned.`,
    );
  }
}

export interface LoggRad {
  naa: number;
  brukerId: number | null;
  formaal: "ukeplan" | "middag" | "ingredienser";
  modell: string;
  forbruk: Forbruk;
  kurs: number;
  status: "ok" | "refusal" | "max_tokens" | "ugyldig_svar" | "feil";
  requestId?: string | null;
  varighetMs?: number | null;
}

/** Skriver én rad i KI-loggen og returnerer kostnaden i øre. Ingen prompt og ingen svar. */
export function loggKall(db: Db, rad: LoggRad): number {
  const mikro = kostnadMikroUsd(rad.forbruk, rad.modell);
  const ore = mikroUsdTilOre(mikro, rad.kurs);
  db.prepare(
    `INSERT INTO ki_logg (tid, maaned, user_id, formaal, modell, input_tokens, cache_skriv_tokens,
       cache_les_tokens, output_tokens, kostnad_mikrousd, kurs, kostnad_ore, status, request_id, varighet_ms)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    new Date(rad.naa).toISOString(),
    maanedFor(rad.naa),
    rad.brukerId,
    rad.formaal,
    rad.modell,
    rad.forbruk.inputTokens,
    rad.forbruk.cacheSkrivTokens,
    rad.forbruk.cacheLesTokens,
    rad.forbruk.outputTokens,
    mikro,
    rad.kurs,
    ore,
    rad.status,
    rad.requestId ?? null,
    rad.varighetMs ?? null,
  );
  return ore;
}
