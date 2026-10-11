import { useState } from "react";
import { Avkrysning, Tekstomrade, Valgfelt } from "../../design/Felt";
import { Infoboks } from "../../design/Infoboks";
import { Knapp } from "../../design/Knapp";
import { Merke } from "../../design/Merke";
import { kortDato, kortUkedag } from "../../lib/dato";
import type { Rett } from "../../lib/types";
import { Fremdrift } from "../ki/Fremdrift";
import { kroner } from "../ki/forslag";
import {
  TIDSROM,
  antallValgt,
  erKlar,
  type MiddagDagRedigert,
  type MiddagLeggInnSvar,
  type MiddagResultat,
  type Tidsrom,
} from "./kiMiddag";
import { formaterSnitt } from "./Stjerner";
import { useKiMiddag } from "./useKiMiddag";

interface DagProps {
  d: MiddagDagRedigert;
  retter: Rett[];
  onEndre: (d: MiddagDagRedigert) => void;
}

/** En dag i forslaget: avkrysning, valgt rett (kan byttes) og begrunnelsen fra KI-en. */
function Dag({ d, retter, onEndre }: DagProps) {
  const dagnavn = `${kortUkedag(d.dato)} ${kortDato(d.dato)}`;
  return (
    <li className={d.valgt ? "kiforslag" : "kiforslag av"}>
      <Avkrysning
        etikett={`Planlegg ${dagnavn}`}
        checked={d.valgt}
        onChange={() => onEndre({ ...d, valgt: !d.valgt })}
      />
      <p className="kimeta">
        <strong>{dagnavn}</strong>
        {d.rett === "ny" && <Merke tone="leire">Ny rett</Merke>}
      </p>
      <Valgfelt
        etikett="Middag"
        value={d.rett}
        onChange={(e) =>
          onEndre({ ...d, rett: e.target.value === "ny" ? "ny" : Number(e.target.value) })
        }
      >
        {d.ny && <option value="ny">{d.ny.tittel} (ny rett)</option>}
        {retter.map((r) => (
          <option key={r.id} value={r.id}>
            {r.tittel}
            {r.snitt !== null ? ` (★ ${formaterSnitt(r.snitt)})` : ""}
          </option>
        ))}
      </Valgfelt>
      {d.begrunnelse && <p className="hint">{d.begrunnelse}</p>}
      {d.gjenbruk.length > 0 && (
        <p className="hint">
          <Merke tone="gronn">Mindre matsvinn</Merke> Bruker opp: {d.gjenbruk.join(", ")}
        </p>
      )}
      {d.rett === "ny" && d.ny && d.ny.ingredienser.length > 0 && (
        <p className="hint">Ingredienser: {d.ny.ingredienser.join(", ")}</p>
      )}
    </li>
  );
}

function Resultat({ svar, onLukk }: { svar: MiddagLeggInnSvar; onLukk: () => void }) {
  const feil = svar.rader.filter((r) => !r.ok);
  return (
    <section className="kiresultat" aria-label="Resultat">
      {svar.antallOk > 0 && (
        <Infoboks type="ok" tittel="Lagt inn">
          {svar.antallOk} {svar.antallOk === 1 ? "middag" : "middager"}
          {svar.nyeRetter > 0
            ? ` og ${svar.nyeRetter} ${svar.nyeRetter === 1 ? "ny rett" : "nye retter"}`
            : ""}
          .
        </Infoboks>
      )}
      {feil.length > 0 && (
        <Infoboks type="feil" tittel="Dette ble ikke lagt inn">
          <ul className="kiadvarsler">
            {feil.map((r) => (
              <li key={r.forslagId}>
                {kortUkedag(r.dato)} {kortDato(r.dato)}: {r.feil}
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

export function ForslagListe({
  resultat,
  dager,
  retter,
  paaHandleliste,
  opptatt,
  onDager,
  onHandleliste,
  onLeggInn,
  onAvbryt,
}: {
  resultat: MiddagResultat;
  dager: MiddagDagRedigert[];
  retter: Rett[];
  paaHandleliste: boolean;
  opptatt: boolean;
  onDager: (d: MiddagDagRedigert[]) => void;
  onHandleliste: (v: boolean) => void;
  onLeggInn: () => void;
  onAvbryt: () => void;
}) {
  const f = resultat.forslag;
  const antall = antallValgt(dager);
  const alleKlare = dager.filter((d) => d.valgt).every(erKlar);
  return (
    <div className="kiforslagliste">
      {f.sammendrag && <p>{f.sammendrag}</p>}
      {f.advarsler.length > 0 && (
        <Infoboks type="advarsel" tittel="Se over før du legger inn">
          <ul className="kiadvarsler">
            {f.advarsler.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        </Infoboks>
      )}
      {dager.length === 0 && <p className="hint">KI-en kom ikke med noe forslag denne gangen.</p>}
      <ul className="kiliste">
        {dager.map((d) => (
          <Dag
            key={d.forslagId}
            d={d}
            retter={retter}
            onEndre={(ny) => onDager(dager.map((x) => (x.forslagId === d.forslagId ? ny : x)))}
          />
        ))}
      </ul>
      {dager.length > 0 && (
        <Avkrysning
          etikett="Legg ingrediensene på handlelisten"
          checked={paaHandleliste}
          onChange={(e) => onHandleliste(e.target.checked)}
        />
      )}
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
          Legg inn {antall}
        </Knapp>
      </div>
    </div>
  );
}

/**
 * Middagsforslag fra KI-en, over ukeplanen. Vises bare for foreldre når KI er på. KI-en foreslår for dagene som
 * mangler middag, ut fra retter, score og hva som er spist, og ingenting lagres før forelderen trykker «Legg inn».
 */
export function KiMiddag({
  retter,
  onInnlagt,
}: {
  retter: Rett[];
  onInnlagt: () => Promise<void>;
}) {
  const m = useKiMiddag(onInnlagt);
  const [apen, setApen] = useState(false);
  if (!m.status?.aktiv) return null;

  if (!apen) {
    return (
      <div className="kimiddag">
        <Knapp ikon="ki" onClick={() => setApen(true)}>
          Foreslå middag med KI
        </Knapp>
      </div>
    );
  }
  const lukk = () => {
    m.lukk();
    setApen(false);
  };

  return (
    <section className="kimiddag kimiddag--apen" aria-label="Middagsforslag fra KI">
      <h3>Foreslå middag med KI</h3>
      {m.feil && <Infoboks type="feil">{m.feil}</Infoboks>}
      {m.fase === "ledig" && (
        <form
          className="nyttskjema"
          onSubmit={(e) => {
            e.preventDefault();
            void m.foresla();
          }}
        >
          <Valgfelt
            etikett="Hvilke dager?"
            hjelp="KI-en foreslår bare for dagene som ikke har middag."
            value={m.tidsrom}
            onChange={(e) => m.setTidsrom(e.target.value as Tidsrom)}
          >
            {TIDSROM.map((t) => (
              <option key={t.id} value={t.id}>
                {t.navn}
              </option>
            ))}
          </Valgfelt>
          <Tekstomrade
            etikett="Ønsker (valgfritt)"
            hjelp="For eksempel «fisk to ganger» eller «noe raskt på onsdag»."
            value={m.onsker}
            onChange={(e) => m.setOnsker(e.target.value)}
            maxLength={300}
            rows={2}
          />
          <div className="handlinger">
            <Knapp onClick={lukk}>Lukk</Knapp>
            <Knapp type="submit" variant="primær" ikon="ki">
              Foreslå
            </Knapp>
          </div>
        </form>
      )}
      {m.fase === "jobber" && <Fremdrift tekst="KI-en setter sammen en ukemeny …" />}
      {(m.fase === "forslag" || m.fase === "legger_inn") && m.resultat && (
        <ForslagListe
          resultat={m.resultat}
          dager={m.dager}
          retter={retter}
          paaHandleliste={m.paaHandleliste}
          opptatt={m.fase === "legger_inn"}
          onDager={m.setDager}
          onHandleliste={m.setPaaHandleliste}
          onLeggInn={() => void m.leggInn()}
          onAvbryt={lukk}
        />
      )}
      {m.fase === "ferdig" && m.innlagt && <Resultat svar={m.innlagt} onLukk={lukk} />}
    </section>
  );
}
