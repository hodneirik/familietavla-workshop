import type { ReactNode } from "react";
import { IkonKnapp, Knapp } from "./Knapp";

/**
 * Toppen av hver fane: tittel til venstre og fanens hovedknapp til høyre. Samme mønster overalt, så det er lett
 * å finne fram. Navigasjon (uke eller måned) legges i en `Navlinje` rett under.
 */
export function Sidetopp({ tittel, children }: { tittel: string; children?: ReactNode }) {
  return (
    <div className="sidetopp">
      <h2>{tittel}</h2>
      {children && <div className="sidetopp__handlinger">{children}</div>}
    </div>
  );
}

/** Linjen under toppen i Kalender og Middag: hvilken uke eller måned, med forrige, i dag og neste. */
export function Navlinje({
  tekst,
  forrige,
  neste,
  iDag,
  enhet,
}: {
  tekst: string;
  forrige: () => void;
  neste: () => void;
  iDag: () => void;
  /** «uke» eller «måned», til knappetekstene for skjermlesere. */
  enhet: string;
}) {
  return (
    <div className="navlinje">
      <p className="navlinje__tekst">{tekst}</p>
      <div className="kalnav">
        <IkonKnapp ikon="forrige" tittel={`Forrige ${enhet}`} onClick={forrige} />
        <Knapp onClick={iDag}>I dag</Knapp>
        <IkonKnapp ikon="neste" tittel={`Neste ${enhet}`} onClick={neste} />
      </div>
    </div>
  );
}
