import { z } from "zod";
import type { Config } from "../../config.js";
import { HttpError } from "../../core/errors.js";
import type { Logger } from "../../core/logger.js";

/** Fast adresse, bygget bare av koordinatene i oppsettet. Appen henter aldri andre adresser. */
const KILDE = "https://allemannsdata.com/wiki/api/v1/kilder/weather/get_forecast";
const TIDSSONE = "Europe/Oslo";
const DAGER = 7;
const TIMER_FREM = 192;
const TIMEOUT_MS = 8_000;
/** Kilden oppdaterer seg ca. hver time, og ber om at man ikke spør oftere enn cachen. */
const FRISK_MS = 30 * 60_000;
const NYTT_FORSOK_MS = 60_000;
const MAKS_FORELDET_MS = 12 * 3_600_000;

const rad = z.object({
  time: z.string(),
  temperature_c: z.number().nullable().optional(),
  wind_speed_ms: z.number().nullable().optional(),
  precipitation_mm: z.number().nullable().optional(),
  symbol: z.string().nullable().optional(),
});
const svar = z.object({ data: z.array(rad) });
type Rad = z.infer<typeof rad>;

export interface Vaerdag {
  /** Lokal dato i Norge, ÅÅÅÅ-MM-DD. */
  dato: string;
  tempMin: number | null;
  tempMaks: number | null;
  /** Sum nedbør i mm over dagen. */
  nedbor: number;
  vindMaks: number | null;
  /** Symbolkode fra MET uten _day/_night, f.eks. «rainshowers». */
  symbol: string | null;
}

export interface Vaervarsel {
  sted: string;
  /** Når appen hentet varselet, ISO-tid. */
  hentet: string;
  /** Sant hvis kilden ikke svarte og dette er et eldre varsel. */
  foreldet: boolean;
  dager: Vaerdag[];
}

const datoFormat = new Intl.DateTimeFormat("sv-SE", {
  timeZone: TIDSSONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  hourCycle: "h23",
});

function lokalTid(iso: string): { dato: string; time: number } | null {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return null;
  const deler = Object.fromEntries(datoFormat.formatToParts(ms).map((d) => [d.type, d.value]));
  return { dato: `${deler.year}-${deler.month}-${deler.day}`, time: Number(deler.hour) };
}

const rund = (n: number) => Math.round(n * 10) / 10;

/** Hvor alvorlig et symbol er. Under 2 er ikke nedbør som er verdt å vise fram for hele dagen. */
function alvor(symbol: string): number {
  if (/thunder/.test(symbol)) return 5;
  if (/heavy/.test(symbol)) return 4;
  if (/light|showers|drizzle/.test(symbol) && /rain|snow|sleet/.test(symbol)) return 2;
  if (/rain|snow|sleet/.test(symbol)) return 3;
  return 0;
}

/** Samler MET-radene (time for time først, så hver sjette time) til én rad per dag i norsk tid. */
export function lagDager(rader: Rad[]): Vaerdag[] {
  const perDag = new Map<string, { rad: Rad; time: number }[]>();
  for (const r of rader) {
    const tid = lokalTid(r.time);
    if (!tid) continue;
    const liste = perDag.get(tid.dato) ?? [];
    liste.push({ rad: r, time: tid.time });
    perDag.set(tid.dato, liste);
  }
  return [...perDag.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(0, DAGER)
    .map(([dato, liste]) => {
      const temp = liste.flatMap((l) => l.rad.temperature_c ?? []);
      const vind = liste.flatMap((l) => l.rad.wind_speed_ms ?? []);
      const nedbor = liste.reduce((sum, l) => sum + (l.rad.precipitation_mm ?? 0), 0);
      // En dag med merkbar nedbør vises med det kraftigste nedbørssymbolet. Ellers symbolet nærmest midt på dagen.
      // (I dag er «midt på dagen» det første som er igjen.)
      const medSymbol = liste.filter((l) => l.rad.symbol);
      const nærmestMidt = (a: { time: number }, b: { time: number }) =>
        Math.abs(a.time - 13) - Math.abs(b.time - 13);
      const verst =
        nedbor >= 1
          ? [...medSymbol]
              .sort((a, b) => alvor(b.rad.symbol!) - alvor(a.rad.symbol!) || nærmestMidt(a, b))
              .find((l) => alvor(l.rad.symbol!) >= 2)
          : undefined;
      const midt = verst ?? [...medSymbol].sort(nærmestMidt)[0];
      return {
        dato,
        tempMin: temp.length ? rund(Math.min(...temp)) : null,
        tempMaks: temp.length ? rund(Math.max(...temp)) : null,
        nedbor: rund(nedbor),
        vindMaks: vind.length ? rund(Math.max(...vind)) : null,
        symbol: midt?.rad.symbol?.replace(/_(day|night|polartwilight)$/, "") ?? null,
      };
    });
}

export interface VaerDeps {
  config: Config;
  log: Logger;
  fetch?: typeof fetch;
  naa?: () => number;
}

/** Henter, mellomlagrer og leverer værvarselet. Én henting om gangen, uansett hvor mange som spør. */
export function lagVaerTjeneste({ config, log, fetch: fetchFn = fetch, naa = Date.now }: VaerDeps) {
  let lagret: { dager: Vaerdag[]; hentetMs: number } | null = null;
  let sisteForsok = 0;
  let underveis: Promise<void> | null = null;

  async function oppdater(): Promise<void> {
    const url = new URL(KILDE);
    url.searchParams.set("lat", String(config.VAER_LAT));
    url.searchParams.set("lon", String(config.VAER_LON));
    url.searchParams.set("hours", String(TIMER_FREM));
    url.searchParams.set("limit", "100");
    const res = await fetchFn(url, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      redirect: "error",
      headers: { accept: "application/json", "user-agent": "Familietavla/1.0 (privat hjemmebruk)" },
    });
    if (!res.ok) throw new Error(`Kilden svarte ${res.status}`);
    const dager = lagDager(svar.parse(await res.json()).data);
    if (dager.length === 0) throw new Error("Kilden ga et tomt varsel");
    lagret = { dager, hentetMs: naa() };
  }

  const tilVarsel = (foreldet: boolean): Vaervarsel => ({
    sted: config.VAER_STED,
    hentet: new Date(lagret!.hentetMs).toISOString(),
    foreldet,
    dager: lagret!.dager,
  });

  return async function hentVarsel(): Promise<Vaervarsel> {
    const na = naa();
    if (lagret && na - lagret.hentetMs < FRISK_MS) return tilVarsel(false);

    if (!underveis && na - sisteForsok >= NYTT_FORSOK_MS) {
      sisteForsok = na;
      underveis = oppdater()
        .catch((err) =>
          log.warn("Fikk ikke hentet værvarsel", {
            feil: err instanceof Error ? err.message : String(err),
          }),
        )
        .finally(() => {
          underveis = null;
        });
    }
    await underveis;

    if (lagret && naa() - lagret.hentetMs < FRISK_MS) return tilVarsel(false);
    if (lagret && naa() - lagret.hentetMs < MAKS_FORELDET_MS) return tilVarsel(true);
    throw new HttpError(503, "Værvarselet er ikke tilgjengelig akkurat nå");
  };
}
