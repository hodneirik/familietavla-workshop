import { Tekstfelt } from "../../design/Felt";
import { Infoboks } from "../../design/Infoboks";
import { IkonKnapp, Knapp } from "../../design/Knapp";
import { useState, type FormEvent } from "react";
import { apiDelete, apiPatch, apiPost } from "../../lib/api";
import type { Kalender } from "../../lib/types";
import { Fargevelger } from "./Fargevelger";

interface Props {
  kalendere: Kalender[];
  onEndret: () => Promise<void>;
}

/** Voksne lager, gir nytt navn og ny farge til, og sletter kalendere. */
export function KalenderAdmin({ kalendere, onEndret }: Props) {
  const [navn, setNavn] = useState("");
  const [farge, setFarge] = useState("#82b797");
  const [redigerer, setRedigerer] = useState<number | null>(null);
  const [nyttNavn, setNyttNavn] = useState("");
  const [nyFarge, setNyFarge] = useState("#889cb0");
  const [feil, setFeil] = useState<string | null>(null);

  const utfør = async (jobb: () => Promise<unknown>) => {
    try {
      await jobb();
      setFeil(null);
      await onEndret();
    } catch (e) {
      setFeil(e instanceof Error ? e.message : "Noe gikk galt");
    }
  };

  const opprett = (e: FormEvent) => {
    e.preventDefault();
    void utfør(async () => {
      await apiPost("/api/kalender/kalendere", { navn, farge });
      setNavn("");
    });
  };

  const slett = (k: Kalender) => {
    if (!window.confirm(`Slette kalenderen «${k.navn}» og alle avtalene i den?`)) return;
    void utfør(() => apiDelete(`/api/kalender/kalendere/${k.id}`));
  };

  return (
    <section className="kaladmin">
      <h3>Kalendere</h3>
      {feil && <Infoboks type="feil">{feil}</Infoboks>}
      <ul className="kalliste">
        {kalendere.map((k) =>
          redigerer === k.id ? (
            <li key={k.id} className="kalrad redigerer">
              <input
                value={nyttNavn}
                onChange={(e) => setNyttNavn(e.target.value)}
                maxLength={40}
                aria-label="Navn"
              />
              <Fargevelger verdi={nyFarge} onChange={setNyFarge} />
              <div className="handlinger">
                <Knapp onClick={() => setRedigerer(null)}>Avbryt</Knapp>
                <Knapp
                  variant="primær"
                  disabled={!nyttNavn.trim()}
                  onClick={() =>
                    void utfør(async () => {
                      await apiPatch(`/api/kalender/kalendere/${k.id}`, {
                        navn: nyttNavn,
                        farge: nyFarge,
                      });
                      setRedigerer(null);
                    })
                  }
                >
                  Lagre
                </Knapp>
              </div>
            </li>
          ) : (
            <li key={k.id} className="kalrad">
              <span className="kalfarge" style={{ background: k.farge }} aria-hidden="true" />
              <span className="kalnavn">
                {k.navn}
                {k.kilde !== "manuell" && <small> · fra {k.kilde}</small>}
              </span>
              <span className="handlinger">
                <IkonKnapp
                  ikon="rediger"
                  tittel={`Endre ${k.navn}`}
                  variant="tekst"
                  onClick={() => {
                    setRedigerer(k.id);
                    setNyttNavn(k.navn);
                    setNyFarge(k.farge);
                  }}
                />
                <IkonKnapp
                  ikon="slett"
                  tittel={`Slett ${k.navn}`}
                  variant="tekst"
                  onClick={() => slett(k)}
                />
              </span>
            </li>
          ),
        )}
      </ul>
      <form className="nyttskjema" onSubmit={opprett}>
        <Tekstfelt
          etikett="Ny kalender"
          value={navn}
          onChange={(e) => setNavn(e.target.value)}
          maxLength={40}
          placeholder="F.eks. Elias fotball"
          required
        />
        <Fargevelger verdi={farge} onChange={setFarge} />
        <Knapp type="submit" variant="primær" ikon="legg_til" disabled={!navn.trim()}>
          Legg til kalender
        </Knapp>
      </form>
    </section>
  );
}
