import { useState } from "react";
import { Infoboks } from "../../design/Infoboks";
import { IkonKnapp, Knapp } from "../../design/Knapp";
import { apiDelete, apiPatch, apiPost } from "../../lib/api";
import type { Paaminnelse } from "../../lib/types";
import { PaaminnelseSkjema, type PaaminnelseUt } from "./PaaminnelseSkjema";
import { UKEDAGER, enkeltdagTekst, periodetekst } from "./paaminnelser";
import { usePaaminnelser } from "./usePaaminnelser";

/**
 * Faste ukentlige påminnelser (gym, bibliotek). Foreldre legger inn, endrer og sletter. Barnet ser
 * sine egne. Vises i Lekser-fanen og smått på dagene i «De neste dagene».
 */
export function Paaminnelser({ forelder }: { forelder: boolean }) {
  const { paaminnelser, feil, setFeil, last } = usePaaminnelser();
  const [visNy, setVisNy] = useState(false);
  const [endrer, setEndrer] = useState<number | null>(null);

  const lagreNy = async (data: PaaminnelseUt) => {
    await apiPost("/api/paaminnelser", data);
    setVisNy(false);
    await last();
  };
  const lagreEndring = async (p: Paaminnelse, data: PaaminnelseUt) => {
    await apiPatch(
      `/api/paaminnelser/${p.id}`,
      p.dato !== null
        ? { tittel: data.tittel, dato: data.dato }
        : { tittel: data.tittel, ukedag: data.ukedager?.[0], fra: data.fra, til: data.til },
    );
    setEndrer(null);
    await last();
  };
  const slett = async (p: Paaminnelse) => {
    if (!window.confirm(`Slette påminnelsen «${p.tittel}» for ${p.barn.visningsnavn}?`)) return;
    try {
      await apiDelete(`/api/paaminnelser/${p.id}`);
      await last();
    } catch (e) {
      setFeil(e instanceof Error ? e.message : "Noe gikk galt");
    }
  };

  const rad = (p: Paaminnelse) =>
    endrer === p.id ? (
      <li key={p.id}>
        <PaaminnelseSkjema
          paaminnelse={p}
          onLagre={(d) => lagreEndring(p, d)}
          onAvbryt={() => setEndrer(null)}
        />
      </li>
    ) : (
      <li key={p.id} className="paaminnelserad" style={{ borderLeftColor: p.barn.farge }}>
        <span className="paaminnelserad__tekst">
          <strong>{p.tittel}</strong>
          {p.dato && <span className="paaminnelser__barn"> · {enkeltdagTekst(p.dato)}</span>}
          {(p.fra || p.til) && <span className="paaminnelser__barn"> · {periodetekst(p)}</span>}
          {forelder && (
            <span className="paaminnelser__barn">
              {" "}
              · {p.barn.emoji ?? "🙂"} {p.barn.visningsnavn}
            </span>
          )}
        </span>
        {forelder && (
          <span className="handlinger">
            <IkonKnapp
              ikon="rediger"
              tittel={`Endre ${p.tittel}`}
              variant="tekst"
              onClick={() => setEndrer(p.id)}
            />
            <IkonKnapp
              ikon="slett"
              tittel={`Slett ${p.tittel}`}
              variant="tekst"
              onClick={() => void slett(p)}
            />
          </span>
        )}
      </li>
    );

  if (!forelder && paaminnelser.length === 0) return null;

  return (
    <section className="seksjon paaminnelser-fane" aria-labelledby="paaminnelser-tittel">
      <div className="oppslag-topp">
        <h3 className="seksjonstittel" id="paaminnelser-tittel">
          Påminnelser
        </h3>
        {forelder && !visNy && (
          <Knapp ikon="legg_til" onClick={() => setVisNy(true)}>
            Ny påminnelse
          </Knapp>
        )}
      </div>
      {feil && <Infoboks type="feil">{feil}</Infoboks>}
      {forelder && visNy && (
        <PaaminnelseSkjema paaminnelse={null} onLagre={lagreNy} onAvbryt={() => setVisNy(false)} />
      )}
      {paaminnelser.length === 0 && !visNy && (
        <p className="hint">
          Ingen faste påminnelser ennå. Legg inn ting som gym og bibliotek, som gjentas hver uke.
        </p>
      )}
      {UKEDAGER.map((navn, i) => {
        const dagens = paaminnelser.filter((p) => p.dato === null && p.ukedag === i);
        return dagens.length === 0 ? null : (
          <div key={navn} className="paaminnelsedag">
            <h4 className="leksetittel">Hver {navn.toLowerCase()}</h4>
            <ul className="paaminnelseliste">{dagens.map(rad)}</ul>
          </div>
        );
      })}
      {paaminnelser.some((p) => p.dato !== null) && (
        <div className="paaminnelsedag">
          <h4 className="leksetittel">Bestemte dager</h4>
          <ul className="paaminnelseliste">
            {paaminnelser.filter((p) => p.dato !== null).map(rad)}
          </ul>
        </div>
      )}
    </section>
  );
}
