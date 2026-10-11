import { Infoboks } from "../../design/Infoboks";
import { Knapp } from "../../design/Knapp";
import { datoMedAar } from "../../lib/dato";
import type { Duplikat } from "./typer";

/** Samme PDF er lagt inn før. Forelderen må bekrefte før det koster penger igjen. */
export function DuplikatVarsel({
  duplikat,
  onLastLikevel,
}: {
  duplikat: Duplikat;
  onLastLikevel: () => void;
}) {
  return (
    <Infoboks type="advarsel" tittel="Denne planen er lagt inn før">
      <p>
        Den samme PDF-en ble lagt inn {datoMedAar(duplikat.innlagt.slice(0, 10))}
        {duplikat.av ? ` av ${duplikat.av}` : ""}. Å lese den igjen koster penger og kan gi
        dubletter.
      </p>
      <Knapp onClick={onLastLikevel}>Les den likevel</Knapp>
    </Infoboks>
  );
}

/** Advarsler fra KI-en og serveren, og hvor mange forslag som ble forkastet. */
export function Advarsler({ advarsler, forkastet }: { advarsler: string[]; forkastet: number }) {
  if (advarsler.length === 0 && forkastet === 0) return null;
  return (
    <Infoboks type="advarsel" tittel="Se over før du legger inn">
      <ul className="kiadvarsler">
        {advarsler.map((a) => (
          <li key={a}>{a}</li>
        ))}
        {forkastet > 0 && (
          <li>
            {forkastet === 1 ? "Ett forslag ble" : `${forkastet} forslag ble`} forkastet fordi de
            var ugyldige eller utenfor uka.
          </li>
        )}
      </ul>
    </Infoboks>
  );
}
