import { useState } from "react";
import { Avkrysning, Tekstfelt, Tekstomrade, Valgfelt } from "../../design/Felt";
import { Infoboks } from "../../design/Infoboks";
import { Knapp } from "../../design/Knapp";
import { Fremdrift } from "../ki/Fremdrift";
import { kroner } from "../ki/forslagLogikk";
import {
  ANTALL_VALG,
  antallValgtRetter,
  erRettKlar,
  type RettRedigert,
  type RetterLeggInnSvar,
  type RetterResultat,
} from "./kiRetterLogikk";
import { useKiRetter } from "./useKiRetter";

function Rett({ r, onEndre }: { r: RettRedigert; onEndre: (r: RettRedigert) => void }) {
  return (
    <li className={r.valgt ? "kiforslag" : "kiforslag av"}>
      <Avkrysning
        etikett={`Legg til retten «${r.tittel}»`}
        checked={r.valgt}
        onChange={() => onEndre({ ...r, valgt: !r.valgt })}
      />
      <div className="kifelter">
        <Tekstfelt
          etikett="Tittel"
          value={r.tittel}
          maxLength={80}
          onChange={(e) => onEndre({ ...r, tittel: e.target.value })}
        />
        <Tekstomrade
          etikett="Ingredienser (én per linje)"
          value={r.ingredienser}
          rows={4}
          onChange={(e) => onEndre({ ...r, ingredienser: e.target.value })}
        />
        <Tekstfelt
          etikett="Notat (valgfritt)"
          value={r.notat}
          maxLength={300}
          onChange={(e) => onEndre({ ...r, notat: e.target.value })}
        />
      </div>
    </li>
  );
}

export function RetterForslagListe({
  resultat,
  retter,
  opptatt,
  onRetter,
  onLeggInn,
  onAvbryt,
}: {
  resultat: RetterResultat;
  retter: RettRedigert[];
  opptatt: boolean;
  onRetter: (r: RettRedigert[]) => void;
  onLeggInn: () => void;
  onAvbryt: () => void;
}) {
  const antall = antallValgtRetter(retter);
  const alleKlare = retter.filter((r) => r.valgt).every(erRettKlar);
  const f = resultat.forslag;
  return (
    <div className="kiforslagliste">
      {f.sammendrag && <p>{f.sammendrag}</p>}
      {f.advarsler.length > 0 && (
        <Infoboks type="advarsel" tittel="Se over før du legger til">
          <ul className="kiadvarsler">
            {f.advarsler.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        </Infoboks>
      )}
      {retter.length === 0 && (
        <p className="hint">
          KI-en kom ikke med noen nye retter denne gangen. Prøv med andre ønsker.
        </p>
      )}
      <ul className="kiliste">
        {retter.map((r) => (
          <Rett
            key={r.forslagId}
            r={r}
            onEndre={(ny) => onRetter(retter.map((x) => (x.forslagId === r.forslagId ? ny : x)))}
          />
        ))}
      </ul>
      <p className="hint">Kostet ca. {kroner(resultat.kostnad_ore)}.</p>
      <div className="handlinger">
        <Knapp onClick={onAvbryt} disabled={opptatt}>
          Avbryt
        </Knapp>
        <Knapp
          variant="primær"
          ikon="hake"
          onClick={onLeggInn}
          disabled={opptatt || antall === 0 || !alleKlare}
        >
          Legg til {antall}
        </Knapp>
      </div>
    </div>
  );
}

function Resultat({ svar, onLukk }: { svar: RetterLeggInnSvar; onLukk: () => void }) {
  const feil = svar.rader.filter((r) => !r.ok);
  return (
    <section className="kiresultat" aria-label="Resultat">
      {svar.antallOk > 0 && (
        <Infoboks type="ok" tittel="Lagt til">
          {svar.antallOk} {svar.antallOk === 1 ? "rett" : "retter"}.
        </Infoboks>
      )}
      {feil.length > 0 && (
        <Infoboks type="feil" tittel="Dette ble ikke lagt til">
          <ul className="kiadvarsler">
            {feil.map((r) => (
              <li key={r.forslagId}>
                {r.forslagId}: {r.feil}
              </li>
            ))}
          </ul>
        </Infoboks>
      )}
      <Knapp variant="primær" onClick={onLukk}>
        Ferdig
      </Knapp>
    </section>
  );
}

/**
 * «Lag retter med KI» øverst i Retter. Beskriv hva slags retter du vil ha, så lager KI-en forslag med ingredienser
 * som du kan rette. Vises bare når KI er på. Ingenting lagres før du trykker «Legg til».
 */
export function KiRetter({ onInnlagt }: { onInnlagt: () => Promise<void> }) {
  const m = useKiRetter(onInnlagt);
  const [apen, setApen] = useState(false);
  if (!m.status?.aktiv) return null;

  if (!apen) {
    return (
      <div className="kimiddag">
        <Knapp ikon="ki" onClick={() => setApen(true)}>
          Lag retter med KI
        </Knapp>
      </div>
    );
  }
  const lukk = () => {
    m.lukk();
    setApen(false);
  };

  return (
    <section className="kimiddag kimiddag--apen" aria-label="Retter fra KI">
      <h3>Lag retter med KI</h3>
      {m.feil && <Infoboks type="feil">{m.feil}</Infoboks>}
      {m.fase === "ledig" && (
        <form
          className="nyttskjema"
          onSubmit={(e) => {
            e.preventDefault();
            void m.foresla();
          }}
        >
          <Tekstomrade
            etikett="Hva slags retter?"
            hjelp="For eksempel «raske fiskeretter» eller «noe vegetarisk som barna spiser». Tomt gir vanlige hverdagsmiddager."
            value={m.onsker}
            onChange={(e) => m.setOnsker(e.target.value)}
            maxLength={300}
            rows={2}
          />
          <Valgfelt
            etikett="Hvor mange?"
            value={m.antall}
            onChange={(e) => m.setAntall(Number(e.target.value))}
          >
            {ANTALL_VALG.map((n) => (
              <option key={n} value={n}>
                {n} retter
              </option>
            ))}
          </Valgfelt>
          <p className="hint">KI-en ser rettene du har fra før og lager noe nytt.</p>
          <div className="handlinger">
            <Knapp onClick={lukk}>Lukk</Knapp>
            <Knapp type="submit" variant="primær" ikon="ki">
              Lag forslag
            </Knapp>
          </div>
        </form>
      )}
      {m.fase === "jobber" && <Fremdrift tekst="KI-en tenker ut nye retter …" />}
      {(m.fase === "forslag" || m.fase === "legger_inn") && m.resultat && (
        <RetterForslagListe
          resultat={m.resultat}
          retter={m.retter}
          opptatt={m.fase === "legger_inn"}
          onRetter={m.setRetter}
          onLeggInn={() => void m.leggInn()}
          onAvbryt={lukk}
        />
      )}
      {m.fase === "ferdig" && m.innlagt && <Resultat svar={m.innlagt} onLukk={lukk} />}
    </section>
  );
}
