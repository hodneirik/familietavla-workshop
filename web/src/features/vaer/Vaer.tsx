import { useCallback, useRef, useState } from "react";
import { AnimertIkon, type IkonSpill } from "../../design/AnimertIkon";
import type { Ikonnavn } from "../../design/ikoner";
import { apiGet } from "../../lib/api";
import type { Vaerdag, Vaervarsel } from "../../lib/types";
import { usePolling } from "../../lib/usePolling";

const OPPDATER_MS = 15 * 60_000;

export type Vaertone = "sol" | "sky" | "regn" | "torden" | "snoe" | null;

/**
 * MET-symbolkoder (uten _day/_night) til ikon, norsk tekst og farge. Rekkefølgen betyr noe.
 * Skyer er alltid grå (det gjøres i selve ikonene). Fargen her er det som kommer i tillegg: sol er gul,
 * regn er blått (også sludd og torden med regn), torden uten regn er gult og snø er kjølig blågrå.
 */
const SYMBOLER: [RegExp, Ikonnavn, string, Vaertone][] = [
  [/thunder/, "torden", "Torden", "torden"],
  [/sleet/, "snøbyger", "Sludd", "regn"],
  [/snow/, "snø", "Snø", "snoe"],
  [/heavyrain/, "regn", "Kraftig regn", "regn"],
  [/lightrain|drizzle/, "sol_regn", "Lett regn", "regn"],
  [/rainshowers/, "sol_regn", "Regnbyger", "regn"],
  [/rain/, "regn", "Regn", "regn"],
  [/fog/, "tåke", "Tåke", "sky"],
  [/clearsky/, "sol", "Klarvær", "sol"],
  [/fair/, "sol_sky", "Lettskyet", null],
  [/partlycloudy/, "sol_sky", "Delvis skyet", null],
  [/cloudy/, "sky", "Skyet", "sky"],
];

export function symbol(kode: string | null): { ikon: Ikonnavn; tekst: string; tone: Vaertone } {
  const treff = kode ? SYMBOLER.find(([re]) => re.test(kode)) : undefined;
  if (!treff || !kode) return { ikon: "temperatur", tekst: "Ukjent vær", tone: null };
  // Torden med regn (for eksempel «rainandthunder») er blått som annet regn
  const tone = /rain|drizzle/.test(kode) ? "regn" : treff[3];
  return { ikon: treff[1], tekst: treff[2], tone };
}

const grader = (t: number | null) => (t === null ? "–" : `${Math.round(t) + 0}°`);
const norsk = (n: number) => String(n).replace(".", ",");

/** Datoen er allerede lokal dato i Norge, så vi regner ukedagen i UTC for å unngå å skli en dag. */
function ukedag(dato: string, erIDag: boolean): string {
  if (erIDag) return "I dag";
  const dag = new Date(`${dato}T12:00:00Z`)
    .toLocaleDateString("nb-NO", { weekday: "short", timeZone: "UTC" })
    .replace(".", "");
  return dag.charAt(0).toUpperCase() + dag.slice(1);
}

function Dag({ d, erIDag, indeks }: { d: Vaerdag; erIDag: boolean; indeks: number }) {
  const spill = useRef<IkonSpill>(null);
  const { ikon, tekst, tone } = symbol(d.symbol);
  const lang = new Date(`${d.dato}T12:00:00Z`).toLocaleDateString("nb-NO", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });
  const beskrivelse = `${lang}: ${tekst}, ${grader(d.tempMaks)} høyest og ${grader(d.tempMin)} lavest, ${
    d.nedbor > 0 ? `${norsk(d.nedbor)} mm nedbør` : "ingen nedbør"
  }`;
  return (
    // Trykk på en dag for å se ikonet bevege seg igjen
    <li
      className={erIDag ? "vaerdag idag" : "vaerdag"}
      title={beskrivelse}
      aria-label={beskrivelse}
      onPointerDown={() => spill.current?.spill()}
    >
      <span className="vaerukedag">{ukedag(d.dato, erIDag)}</span>
      <span className={tone ? `vaersymbol ${tone}` : "vaersymbol"}>
        <AnimertIkon ref={spill} navn={ikon} storrelse="xl" spillVedStart={100 + indeks * 120} />
      </span>
      <span className="vaermaks">{grader(d.tempMaks)}</span>
      <span className="vaermin">{grader(d.tempMin)}</span>
      <span className="vaernedbor">{d.nedbor >= 0.1 ? `${norsk(d.nedbor)} mm` : " "}</span>
    </li>
  );
}

/** Sju dagers værvarsel over oppslagstavla. Vises ikke hvis varselet ikke er tilgjengelig. */
export function Vaer() {
  const [varsel, setVarsel] = useState<Vaervarsel | null>(null);

  const last = useCallback(async () => {
    try {
      setVarsel(await apiGet<Vaervarsel>("/api/vaer"));
    } catch {
      // Appen virker like fint uten vær. Beholder siste varsel hvis vi har et.
    }
  }, []);
  usePolling(last, OPPDATER_MS);

  if (!varsel || varsel.dager.length === 0) return null;
  return (
    <section className="vaer" aria-label={`Værvarsel for ${varsel.sted}`}>
      <ul className="vaerdager">
        {varsel.dager.map((d, i) => (
          <Dag key={d.dato} d={d} erIDag={i === 0} indeks={i} />
        ))}
      </ul>
    </section>
  );
}
