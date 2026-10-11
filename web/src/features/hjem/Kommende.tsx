import { useMemo, type ReactNode } from "react";
import { Infoboks } from "../../design/Infoboks";
import { apiPut } from "../../lib/api";
import { iDag, leggTilDager } from "../../lib/dato";
import type { Lekse } from "../../lib/types";
import { useDagsplan } from "../dagsliste/Dagsliste";
import { dagerTilSondag } from "../dagsliste/tid";
import { sorterEtterBarn } from "../lekser/sorter";
import { useLekser } from "../lekser/useLekser";
import { paaminnelserForDag } from "../paaminnelser/paaminnelser";
import { usePaaminnelser } from "../paaminnelser/usePaaminnelser";
import { Dagkort } from "./Dagkort";

/**
 * Leksene på en dag: de som har frist da. På dagens kort kommer også de som skulle vært gjort før.
 * Sortert etter barn.
 */
export function lekserForDag(lekser: Lekse[], dato: string, idag: string): Lekse[] {
  return sorterEtterBarn(
    lekser.filter((l) => l.frist === dato || (dato === idag && l.frist < idag && !l.gjort)),
  );
}

/**
 * De neste dagene: fra i dag og ut uka, til og med nærmeste søndag, med hver dag i et eget kort
 * på samme måte som i ukevisningen. På en søndag er det bare søndagen. Bare barna (`kanGiStjerner`) kan gi dagens middag stjerner.
 */
export function Kommende({
  kanGiStjerner = false,
  forelder = false,
  besteforelder = false,
  etterIDag,
}: {
  kanGiStjerner?: boolean;
  forelder?: boolean;
  besteforelder?: boolean;
  /**
   * Settes inn mellom dagens kort og resten av dagene (oppslagstavla på telefonen). Da får dagens kort
   * overskriften «I dag», og resten «De neste dagene». Uten den står alle dagene samlet.
   */
  etterIDag?: ReactNode;
}) {
  const idag = iDag();
  const dager = useMemo(() => dagerTilSondag(idag), [idag]);
  const til = leggTilDager(dager.at(-1)!, 1);
  const { kalendere, hendelser, middager, feil, setFeil, last } = useDagsplan(idag, til);
  const lekser = useLekser();
  const paaminnelser = usePaaminnelser();

  const giStjerner = async (dato: string, stjerner: number) => {
    await apiPut(`/api/middag/${dato}/stjerner`, { stjerner });
    await last();
  };

  const kalenderMap = useMemo(() => new Map(kalendere.map((k) => [k.id, k])), [kalendere]);
  const middagPerDato = useMemo(() => new Map(middager.map((m) => [m.dato, m])), [middager]);

  const kort = (d: string) => (
    <Dagkort
      key={d}
      dato={d}
      erIDag={d === idag}
      hendelser={hendelser}
      middag={middagPerDato.get(d) ?? null}
      kalenderMap={kalenderMap}
      lekser={lekserForDag(lekser.lekser, d, idag)}
      paaminnelser={paaminnelserForDag(paaminnelser.paaminnelser, d)}
      forelder={forelder}
      bareLese={besteforelder}
      onLekseEndret={lekser.last}
      onFeil={setFeil}
      onStjerner={d === idag && kanGiStjerner ? giStjerner : undefined}
    />
  );
  const feilmelding = (feil ?? lekser.feil ?? paaminnelser.feil) && (
    <Infoboks type="feil">{feil ?? lekser.feil ?? paaminnelser.feil}</Infoboks>
  );

  if (etterIDag !== undefined) {
    const [forste, ...resten] = dager;
    return (
      <>
        <section className="kommende" aria-label="I dag">
          <h2>I dag</h2>
          {feilmelding}
          <div className="ukevisning">{forste && kort(forste)}</div>
        </section>
        {etterIDag}
        {resten.length > 0 && (
          <section className="kommende" aria-label="De neste dagene">
            <h2>De neste dagene</h2>
            <div className="ukevisning">{resten.map(kort)}</div>
          </section>
        )}
      </>
    );
  }

  return (
    <section className="kommende" aria-label="De neste dagene">
      <h2>De neste dagene</h2>
      {feilmelding}
      <div className="ukevisning">{dager.map(kort)}</div>
    </section>
  );
}
