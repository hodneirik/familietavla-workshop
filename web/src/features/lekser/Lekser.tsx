import { useState } from "react";
import { useAuth } from "../../app/AuthContext";
import { Infoboks } from "../../design/Infoboks";
import { Knapp } from "../../design/Knapp";
import { apiPost } from "../../lib/api";
import { iDag } from "../../lib/dato";
import { useLekser } from "./useLekser";
import { LekseRad } from "./LekseRad";
import { LeksSkjema, type LekseUt } from "./LeksSkjema";
import { Paaminnelser } from "../paaminnelser/Paaminnelser";
import { KiUkeplan } from "../ki/KiUkeplan";
import { Sidetopp } from "../../design/Sidetopp";

/**
 * Skole-fanen: lekser og påminnelser. Barnet ser og krysser av sine egne, og voksne legger inn og ser alle barnas.
 * Foreldre kan også la KI-en lese ukeplanen fra skolen herfra.
 */
export function Lekser() {
  const { bruker } = useAuth();
  const { lekser, feil, setFeil, last } = useLekser();
  const [visNy, setVisNy] = useState(false);
  if (!bruker) return null;
  const forelder = bruker.rolle === "forelder";
  const idag = iDag();

  const lagre = async (data: LekseUt) => {
    await apiPost("/api/lekser", data);
    setVisNy(false);
    await last();
  };

  const igjen = lekser.filter((l) => !l.gjort);
  const gjort = lekser.filter((l) => l.gjort).reverse();
  const rad = (l: (typeof lekser)[number]) => (
    <LekseRad
      key={l.id}
      l={l}
      forelder={forelder}
      visFrist
      forfalt={!l.gjort && l.frist < idag}
      onEndret={last}
      onFeil={setFeil}
    />
  );

  return (
    <section className="lekser">
      <Sidetopp tittel="Skole">
        {forelder && !visNy && (
          <Knapp variant="primær" ikon="legg_til" onClick={() => setVisNy(true)}>
            Ny lekse
          </Knapp>
        )}
      </Sidetopp>
      {forelder && (
        <div className="sideverktoy">
          <KiUkeplan onInnlagt={last} />
        </div>
      )}

      {feil && <Infoboks type="feil">{feil}</Infoboks>}

      {forelder && visNy && (
        <LeksSkjema lekse={null} onLagre={lagre} onAvbryt={() => setVisNy(false)} />
      )}

      {igjen.length > 0 && (
        <section className="seksjon">
          <h3 className="seksjonstittel">Lekser</h3>
          <ul className="hendelser">{igjen.map(rad)}</ul>
        </section>
      )}
      {gjort.length > 0 && (
        <section className="seksjon">
          <h3 className="seksjonstittel">Lekser som er gjort</h3>
          <ul className="hendelser">{gjort.map(rad)}</ul>
        </section>
      )}
      {igjen.length === 0 && gjort.length === 0 && !visNy && (
        <p className="hint tomtavle">
          {forelder
            ? "Ingen lekser ennå. Trykk «Ny lekse» for å legge inn den første."
            : "Du har ingen lekser. Fint!"}
        </p>
      )}

      <Paaminnelser forelder={forelder} />
    </section>
  );
}
