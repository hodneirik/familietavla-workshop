import { Knapp } from "../../design/Knapp";
import { SKIP } from "./forslag";
import type { Sporsmaal } from "./typer";

interface Props {
  sporsmaal: Sporsmaal[];
  valgt: Record<string, string>;
  opptatt: boolean;
  onVelg: (id: string, svar: string) => void;
  onSend: () => void;
  onVisForslag: () => void;
}

/** KI-en spør i stedet for å gjette. Hvert spørsmål har svarknapper, og «Hopp over» er alltid et valg. */
export function Spoersmaal({ sporsmaal, valgt, opptatt, onVelg, onSend, onVisForslag }: Props) {
  const ferdig = sporsmaal.every((s) => valgt[s.id] !== undefined);
  return (
    <section className="kisporsmaal" aria-label="Spørsmål fra KI-en">
      <h3>KI-en lurer på noe</h3>
      {sporsmaal.map((s) => (
        <fieldset key={s.id} className="kispm">
          <legend>{s.tekst}</legend>
          <div className="kivalg" role="radiogroup" aria-label={s.tekst}>
            {[...new Set(s.valg.map((v) => v.tekst)), SKIP]
              .filter((t, i, alle) => t !== SKIP || i === alle.length - 1)
              .map((tekst) => (
                <button
                  key={tekst}
                  type="button"
                  role="radio"
                  aria-checked={valgt[s.id] === tekst}
                  className={valgt[s.id] === tekst ? "kivalgknapp valgt" : "kivalgknapp"}
                  onClick={() => onVelg(s.id, tekst)}
                  disabled={opptatt}
                >
                  {tekst}
                </button>
              ))}
          </div>
        </fieldset>
      ))}
      <div className="handlinger">
        <Knapp onClick={onVisForslag} disabled={opptatt}>
          Vis forslagene uten å svare
        </Knapp>
        <Knapp variant="primær" ikon="hake" onClick={onSend} disabled={opptatt || !ferdig}>
          Oppdater forslagene
        </Knapp>
      </div>
    </section>
  );
}
