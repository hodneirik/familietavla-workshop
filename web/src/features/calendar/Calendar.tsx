import { Infoboks } from "../../design/Infoboks";
import { Navlinje, Sidetopp } from "../../design/Sidetopp";
import { IkonKnapp, Knapp } from "../../design/Knapp";
import { lesbarTekstfarge } from "../../lib/farge";
import { useMemo, useState } from "react";
import { useAuth } from "../../app/AuthContext";
import { apiDelete, apiPost, apiPut } from "../../lib/api";
import {
  dagFra,
  iDag,
  langDato,
  leggTilDager,
  leggTilManeder,
  maanedOgAar,
  maanedStart,
  rutenett,
  ukedagNavn,
  ukenr,
} from "../../lib/dato";
import type { Hendelse } from "../../lib/types";
import { Dagsinnhold, useDagsplan } from "../dagsliste/Dagsliste";
import { paaDag } from "../dagsliste/tid";
import { HendelseSkjema, type HendelseUt } from "./HendelseSkjema";
import { KalenderAdmin } from "./KalenderAdmin";

const SKJULT_NOKKEL = "kalender-skjulte";
const MAKS_PER_CELLE = 3;

function lesSkjulte(): number[] {
  try {
    const verdi: unknown = JSON.parse(localStorage.getItem(SKJULT_NOKKEL) ?? "[]");
    return Array.isArray(verdi) ? verdi.filter((v): v is number => typeof v === "number") : [];
  } catch {
    return [];
  }
}

/**
 * Beskrivelsen av en dag i månedsvisningen: datoen og hvilke avtaler som ligger der. Den brukes som
 * hjelpetekst (title), mens navnet på cellen er det som står i den, slik at synlig tekst og navn stemmer.
 */
export function dagBeskrivelse(dato: string, hendelser: Hendelse[]): string {
  if (hendelser.length === 0) return `${langDato(dato)}, ingen avtaler`;
  const antall = hendelser.length === 1 ? "1 avtale" : `${hendelser.length} avtaler`;
  return `${langDato(dato)}, ${antall}: ${hendelser.map((h) => h.tittel).join(", ")}`;
}

type SkjemaTilstand = { hendelse: Hendelse | null; dato: string } | null;

export function Calendar() {
  const { bruker } = useAuth();
  const forelder = bruker?.rolle === "forelder";
  const dagensDato = iDag();

  const [anker, setAnker] = useState(dagensDato);
  const [valgt, setValgt] = useState(dagensDato);
  const [skjulte, setSkjulte] = useState<number[]>(lesSkjulte);
  const [skjema, setSkjema] = useState<SkjemaTilstand>(null);
  const [visAdmin, setVisAdmin] = useState(false);

  const dager = useMemo(() => rutenett(anker), [anker]);
  const fra = dager[0]!;
  const til = leggTilDager(dager.at(-1)!, 1);

  const { kalendere, hendelser, middager, feil, setFeil, last } = useDagsplan(fra, til);

  const kalenderMap = useMemo(() => new Map(kalendere.map((k) => [k.id, k])), [kalendere]);
  const synlige = useMemo(
    () => hendelser.filter((h) => !skjulte.includes(h.kalenderId)),
    [hendelser, skjulte],
  );
  const forDag = (dato: string) => synlige.filter((h) => paaDag(h, dato));
  const middagPerDato = useMemo(() => new Map(middager.map((m) => [m.dato, m])), [middager]);
  /** Middagen og avtalene for en dag, med knapper for å endre (bare voksne). */
  const innhold = (dato: string, tomTekst: string) => (
    <Dagsinnhold
      hendelser={forDag(dato)}
      middag={middagPerDato.get(dato) ?? null}
      kalenderMap={kalenderMap}
      kanEndre={!!forelder}
      onRediger={(x) => setSkjema({ hendelse: x, dato: dagFra(x.start) })}
      onSlett={slett}
      tomTekst={tomTekst}
    />
  );

  const veksleKalender = (id: number) => {
    const ny = skjulte.includes(id) ? skjulte.filter((s) => s !== id) : [...skjulte, id];
    setSkjulte(ny);
    try {
      localStorage.setItem(SKJULT_NOKKEL, JSON.stringify(ny));
    } catch {
      // Valget gjelder bare til siden lastes på nytt
    }
  };

  const gaTil = (nyttAnker: string) => {
    setAnker(nyttAnker);
    const dagenErMed = dagensDato.slice(0, 7) === nyttAnker.slice(0, 7);
    setValgt(dagenErMed ? dagensDato : maanedStart(nyttAnker));
  };
  const forrige = () => gaTil(leggTilManeder(anker, -1));
  const neste = () => gaTil(leggTilManeder(anker, 1));
  const tilIDag = () => {
    setAnker(dagensDato);
    setValgt(dagensDato);
  };

  const lagre = async (data: HendelseUt) => {
    if (skjema?.hendelse) await apiPut(`/api/kalender/hendelser/${skjema.hendelse.id}`, data);
    else await apiPost("/api/kalender/hendelser", data);
    setSkjema(null);
    await last();
  };
  const slett = (h: Hendelse) => {
    const ekstra = h.gjentas ? " Alle ukene avtalen gjentas blir slettet." : "";
    if (!window.confirm(`Slette «${h.tittel}»?${ekstra}`)) return;
    apiDelete(`/api/kalender/hendelser/${h.id}`)
      .then(last)
      .catch((e: Error) => setFeil(e.message));
  };

  const nyKnapp = (dato: string) =>
    forelder && (
      <Knapp variant="primær" ikon="legg_til" onClick={() => setSkjema({ hendelse: null, dato })}>
        Ny avtale
      </Knapp>
    );

  return (
    <section className="kalender">
      <Sidetopp tittel="Kalender">
        {forelder && (
          <IkonKnapp
            ikon="innstillinger"
            tittel="Kalendere"
            aria-expanded={visAdmin}
            onClick={() => setVisAdmin(!visAdmin)}
          />
        )}
      </Sidetopp>
      <Navlinje
        tekst={maanedOgAar(anker)}
        forrige={forrige}
        neste={neste}
        iDag={tilIDag}
        enhet="måned"
      />

      {kalendere.length > 0 && (
        <ul className="kalfilter" aria-label="Vis kalendere">
          {kalendere.map((k) => {
            const av = skjulte.includes(k.id);
            return (
              <li key={k.id}>
                <button
                  type="button"
                  className={av ? "av" : ""}
                  aria-pressed={!av}
                  onClick={() => veksleKalender(k.id)}
                >
                  <span className="kalfarge" style={{ background: k.farge }} aria-hidden="true" />
                  {k.navn}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {feil && <Infoboks type="feil">{feil}</Infoboks>}

      {forelder && visAdmin && <KalenderAdmin kalendere={kalendere} onEndret={last} />}

      {skjema && (
        <HendelseSkjema
          key={skjema.hendelse?.id ?? `ny-${skjema.dato}`}
          kalendere={kalendere}
          hendelse={skjema.hendelse}
          dato={skjema.dato}
          onLagre={lagre}
          onAvbryt={() => setSkjema(null)}
        />
      )}

      <>
        <div className="manedsrutenett" role="grid" aria-label={maanedOgAar(anker)}>
          <div className="ukehode" role="row">
            <span className="ukenr">uke</span>
            {ukedagNavn.map((d) => (
              <span key={d} role="columnheader">
                {d}
              </span>
            ))}
          </div>
          {Array.from({ length: dager.length / 7 }, (_, u) => (
            <div className="manedsuke" role="row" key={dager[u * 7]}>
              <span className="ukenr">{ukenr(dager[u * 7]!)}</span>
              {dager.slice(u * 7, u * 7 + 7).map((d) => {
                const hend = forDag(d);
                const klasser = [
                  "dagcelle",
                  d === dagensDato ? "idag" : "",
                  d === valgt ? "valgt" : "",
                  d.slice(0, 7) !== anker.slice(0, 7) ? "utenfor" : "",
                ].join(" ");
                return (
                  <button
                    type="button"
                    key={d}
                    role="gridcell"
                    className={klasser}
                    onClick={() => setValgt(d)}
                    title={dagBeskrivelse(d, hend)}
                    aria-selected={d === valgt}
                  >
                    <span className="dagnr">{Number(d.slice(8))}</span>
                    {hend.slice(0, MAKS_PER_CELLE).map((h) => (
                      <span
                        key={`${h.id}-${h.start}`}
                        className="pille"
                        style={{
                          background: kalenderMap.get(h.kalenderId)?.farge,
                          color: lesbarTekstfarge(kalenderMap.get(h.kalenderId)?.farge ?? ""),
                        }}
                      >
                        {h.tittel}
                      </span>
                    ))}
                    {hend.length > MAKS_PER_CELLE && (
                      <span
                        className="flere"
                        data-antall={hend.length - MAKS_PER_CELLE}
                        aria-hidden="true"
                      />
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        <section className="valgtdag" aria-live="polite">
          <div className="valgtdagtopp">
            <h3>{langDato(valgt)}</h3>
            {nyKnapp(valgt)}
          </div>
          {innhold(valgt, "Ingen avtaler eller middag.")}
        </section>
      </>
    </section>
  );
}
