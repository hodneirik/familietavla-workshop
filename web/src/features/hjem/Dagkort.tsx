import { useId } from "react";
import { kortDato, kortUkedag } from "../../lib/dato";
import type { Hendelse, Kalender, Lekse, Middag, Paaminnelse } from "../../lib/types";
import { Dagsinnhold } from "../dagsliste/Dagsliste";
import { paaDag } from "../dagsliste/tid";
import { LekseRad } from "../lekser/LekseRad";
import { PaaminnelseLinje } from "../paaminnelser/PaaminnelseLinje";

interface Props {
  dato: string;
  erIDag: boolean;
  hendelser: Hendelse[];
  middag: Middag | null;
  kalenderMap: Map<number, Kalender>;
  /** Leksene som skal vises på dagen: de som har frist da, og på dagens kort også de som er forfalt. */
  lekser?: Lekse[];
  /** Faste påminnelser for ukedagen (gym, bibliotek). Vises smått og samlet øverst på dagen. */
  paaminnelser?: Paaminnelse[];
  /** Voksne ser hvem leksa og påminnelsen er til, og foreldre kan endre og slette leksa. */
  forelder?: boolean;
  /** Besteforeldre ser leksene, men kan ikke krysse av. */
  bareLese?: boolean;
  onLekseEndret?: () => Promise<void>;
  onFeil?: (melding: string) => void;
  /** Gis bare for dagens middag, så man kan gi den stjerner. */
  onStjerner?: (dato: string, stjerner: number) => Promise<void>;
}

/** En dag i et eget hvitt kort, med middag, avtaler og lekser. Brukes av «De neste dagene» og av uka. */
export function Dagkort({
  dato,
  erIDag,
  hendelser,
  middag,
  kalenderMap,
  lekser = [],
  paaminnelser = [],
  forelder = false,
  bareLese = false,
  onLekseEndret,
  onFeil,
  onStjerner,
}: Props) {
  const leksetittelId = useId();
  return (
    <section className={erIDag ? "ukedag idag" : "ukedag"}>
      <div className="ukedagtopp">
        <h3>
          {kortUkedag(dato)} {kortDato(dato)}
        </h3>
      </div>
      <PaaminnelseLinje paaminnelser={paaminnelser} medBarn={forelder || bareLese} />
      <Dagsinnhold
        hendelser={hendelser.filter((h) => paaDag(h, dato))}
        middag={middag}
        kalenderMap={kalenderMap}
        kanEndre={false}
        tomTekst={lekser.length > 0 ? null : "Ingen avtaler"}
        onStjerner={onStjerner}
      />
      {lekser.length > 0 && (
        <>
          <h4 className="leksetittel" id={leksetittelId}>
            Lekser
          </h4>
          <ul className="hendelser leksliste" aria-labelledby={leksetittelId}>
            {lekser.map((l) => (
              <LekseRad
                key={l.id}
                l={l}
                forelder={forelder}
                bareLese={bareLese}
                utenHandlinger
                forfalt={!l.gjort && l.frist < dato}
                onEndret={onLekseEndret ?? (async () => undefined)}
                onFeil={onFeil ?? (() => undefined)}
              />
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
