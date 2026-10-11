import { Infoboks } from "../../design/Infoboks";
import { Knapp } from "../../design/Knapp";
import type { LeggInnSvar, RadResultat } from "./typer";

/** Hva som ble lagt inn, og hva som ikke lot seg lagre. */
export function Resultat({ svar, onNy }: { svar: LeggInnSvar; onNy: () => void }) {
  const ok = svar.rader.filter((r) => r.ok);
  const feil = svar.rader.filter((r) => !r.ok);
  const tell = (t: RadResultat["type"]) => ok.filter((r) => r.type === t).length;
  return (
    <section className="kiresultat" aria-label="Resultat">
      {ok.length > 0 && (
        <Infoboks type="ok" tittel="Lagt inn">
          {tell("lekse")} {tell("lekse") === 1 ? "lekse" : "lekser"}, {tell("avtale")}{" "}
          {tell("avtale") === 1 ? "avtale" : "avtaler"}, {tell("paaminnelse")}{" "}
          {tell("paaminnelse") === 1 ? "påminnelse" : "påminnelser"} og {tell("lapp")}{" "}
          {tell("lapp") === 1 ? "lapp" : "lapper"}.
        </Infoboks>
      )}
      {feil.length > 0 && (
        <Infoboks type="feil" tittel="Dette ble ikke lagt inn">
          <ul className="kiadvarsler">
            {feil.map((r) => (
              <li key={r.forslagId}>
                {r.type === "lekse"
                  ? "Lekse"
                  : r.type === "avtale"
                    ? "Avtale"
                    : r.type === "paaminnelse"
                      ? "Påminnelse"
                      : "Lapp"}{" "}
                {r.forslagId}: {r.feil}
              </li>
            ))}
          </ul>
        </Infoboks>
      )}
      <Knapp variant="primær" onClick={onNy}>
        Les en ny plan
      </Knapp>
    </section>
  );
}
