import { Infoboks } from "../../design/Infoboks";
import { kroner } from "./forslagLogikk";
import type { KiStatusSvar } from "./typer";

/** Hva KI-en har kostet denne måneden, og hvorfor den eventuelt er av. */
export function KiStatus({ status }: { status: KiStatusSvar | null }) {
  if (!status) return null;
  if (status.grunn === "avskrudd") {
    return <Infoboks type="info">KI er skrudd av i oppsettet.</Infoboks>;
  }
  if (status.grunn === "mangler_nokkel") {
    return (
      <Infoboks type="info" tittel="KI er ikke satt opp ennå">
        Den som drifter appen må legge inn en nøkkel fra Anthropic i oppsettet (.env). Til da kan du
        ikke bruke KI.
      </Infoboks>
    );
  }
  return (
    <>
      {status.grunn === "tak_naadd" && (
        <Infoboks type="advarsel" tittel="Månedstaket er nådd">
          KI stopper til første dag i neste måned.
        </Infoboks>
      )}
      <p className="hint kistatus">
        Brukt {kroner(status.brukt_ore)} av {kroner(status.tak_ore)} denne måneden ({status.antall}{" "}
        kall).
      </p>
    </>
  );
}
