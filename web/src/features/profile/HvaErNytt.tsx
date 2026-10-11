import { useAuth } from "../../app/AuthContext";
import { Ikon } from "../../design/Ikon";
import { Merke } from "../../design/Merke";
import { datoMedAar } from "../../lib/dato";
import { gjeldendeVersjon, versjoner, versjonsnummer } from "./nytt";

/** Hva som er nytt i appen, nyeste versjon først. Barn ser ikke det som bare gjelder voksne. */
export function HvaErNytt() {
  const { bruker } = useAuth();
  const erVoksen = bruker?.rolle === "forelder";

  return (
    <section className="hvanytt" aria-label="Hva er nytt">
      <h3 className="nyttittel">
        <Ikon navn="nytt" storrelse="m" /> Hva er nytt
      </h3>
      <p className="hint">
        Du bruker versjon {versjonsnummer(gjeldendeVersjon)}, «{gjeldendeVersjon.navn}».
      </p>
      <div className="versjonsliste">
        {versjoner.map((v, i) => {
          const endringer = v.endringer.filter((e) => erVoksen || e.for !== "voksne");
          return (
            <details key={versjonsnummer(v)} className="versjon" open={i === 0}>
              <summary>
                <span className="versjonsnavn">
                  Versjon {versjonsnummer(v)} «{v.navn}»
                </span>
                <span className="versjonsdato">
                  {datoMedAar(v.dato)}
                  {i === 0 && (
                    <>
                      {" "}
                      <Merke tone="gronn">Nyeste</Merke>
                    </>
                  )}
                </span>
                <span className="versjonstittel">{v.tittel}</span>
              </summary>
              <ul>
                {endringer.map((e) => (
                  <li key={e.tekst}>
                    {e.tekst}
                    {e.for === "voksne" && <small className="voksenmerke"> Bare voksne</small>}
                  </li>
                ))}
              </ul>
            </details>
          );
        })}
      </div>
    </section>
  );
}
