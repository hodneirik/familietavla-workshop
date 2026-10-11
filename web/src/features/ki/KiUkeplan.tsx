import { useState } from "react";
import { Infoboks } from "../../design/Infoboks";
import { Knapp } from "../../design/Knapp";
import { iDag } from "../../lib/dato";
import { Advarsler, DuplikatVarsel } from "./Advarsler";
import { Forslag } from "./Forslag";
import { Fremdrift } from "./Fremdrift";
import { Opplasting } from "./Opplasting";
import { Resultat } from "./Resultat";
import { Spoersmaal } from "./Spoersmaal";
import { antallValgt, mangler } from "./forslagLogikk";
import { useKi } from "./useKi";

/**
 * «Les ukeplan med KI» i Skole-fanen (bare foreldre): last opp ukeplanen, la KI-en lese den, og legg inn det du
 * godkjenner. Vises bare når KI er på. Innstillingene for KI ligger under Innstillinger.
 */
export function KiUkeplan({ onInnlagt }: { onInnlagt?: () => Promise<void> }) {
  const ki = useKi();
  const [svarValg, setSvarValg] = useState<Record<string, string>>({});
  const [apen, setApen] = useState(false);
  const aktiv = ki.status?.aktiv ?? false;
  const manglerFor = mangler(ki.forslag);
  if (!aktiv) return null;

  if (!apen) {
    return (
      <div className="kimiddag">
        <Knapp ikon="ki" onClick={() => setApen(true)}>
          Les ukeplan med KI
        </Knapp>
      </div>
    );
  }
  const lukk = () => {
    ki.nullstill();
    setApen(false);
  };

  return (
    <section className="ki kimiddag kimiddag--apen" aria-label="Les ukeplan med KI">
      <h3>Les ukeplan med KI</h3>
      {ki.feil && <Infoboks type="feil">{ki.feil}</Infoboks>}

      {ki.duplikat && (
        <DuplikatVarsel duplikat={ki.duplikat} onLastLikevel={() => ki.start(true)} />
      )}

      {ki.fase === "ledig" && (
        <Opplasting
          pdf={ki.pdf}
          uke={ki.uke}
          idag={iDag()}
          barn={ki.innst?.barn ?? []}
          barnIder={ki.barnIder}
          aktiv={aktiv}
          opptatt={false}
          onFil={(f) => void ki.velgFil(f)}
          onUke={ki.setUke}
          onBarn={ki.setBarnIder}
          onStart={() => ki.start()}
        />
      )}
      {ki.fase === "ledig" && (
        <div className="handlinger">
          <Knapp onClick={lukk}>Lukk</Knapp>
        </div>
      )}
      {ki.fase === "analyserer" && (
        <Fremdrift tekst="KI-en leser ukeplanen. Det kan ta et halvt minutt …" />
      )}

      {ki.fase === "spoersmaal" && ki.analyse && (
        <Spoersmaal
          sporsmaal={ki.analyse.forslag.spoersmaal}
          valgt={svarValg}
          opptatt={false}
          onVelg={(id, svar) => setSvarValg({ ...svarValg, [id]: svar })}
          onSend={() => {
            ki.sendSvar(svarValg);
            setSvarValg({});
          }}
          onVisForslag={ki.visForslag}
        />
      )}

      {(ki.fase === "forslag" || ki.fase === "legger_inn") && ki.analyse && (
        <>
          {ki.analyse.forslag.sammendrag && (
            <p className="kisammendrag">{ki.analyse.forslag.sammendrag}</p>
          )}
          <Advarsler
            advarsler={ki.analyse.forslag.advarsler}
            forkastet={ki.analyse.forslag.forkastet}
          />
          <Forslag state={ki.forslag} kalendere={ki.innst?.kalendere ?? []} send={ki.dispatch} />
          <p className="hint">
            Kostet ca.{" "}
            {(ki.analyse.kostnad_ore / 100).toLocaleString("nb-NO", { minimumFractionDigits: 2 })}{" "}
            kr.
          </p>
          {manglerFor.length > 0 && antallValgt(ki.forslag) > 0 && (
            <Infoboks type="advarsel">
              <ul className="kiadvarsler">
                {manglerFor.map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
            </Infoboks>
          )}
          {ki.fase === "legger_inn" && <Fremdrift tekst="Legger inn …" />}
          <div className="handlinger">
            <Knapp onClick={lukk} disabled={ki.fase === "legger_inn"}>
              Avbryt
            </Knapp>
            <Knapp
              variant="primær"
              storrelse="stor"
              ikon="hake"
              onClick={() => void ki.leggInn()}
              disabled={ki.fase === "legger_inn" || manglerFor.length > 0}
            >
              Legg inn {antallValgt(ki.forslag)}
            </Knapp>
          </div>
        </>
      )}

      {ki.fase === "ferdig" && ki.resultat && (
        <Resultat
          svar={ki.resultat}
          onNy={() => {
            void onInnlagt?.();
            ki.nullstill();
          }}
        />
      )}
    </section>
  );
}
