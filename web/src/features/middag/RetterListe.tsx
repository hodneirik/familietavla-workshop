import { Infoboks } from "../../design/Infoboks";
import { Sidetopp } from "../../design/Sidetopp";
import { useCallback, useState } from "react";
import { apiGet } from "../../lib/api";
import type { Rett } from "../../lib/types";
import { usePolling } from "../../lib/usePolling";
import { Score, Snitt } from "./Stjerner";

/** Barnas visning: alle middagsrettene med snittet, og scoren man selv har gitt. Ingenting annet. */
export function RetterListe() {
  const [retter, setRetter] = useState<Rett[] | null>(null);
  const [feil, setFeil] = useState<string | null>(null);

  const last = useCallback(async () => {
    try {
      setRetter(await apiGet<Rett[]>("/api/middag/retter"));
      setFeil(null);
    } catch (e) {
      setFeil(e instanceof Error ? e.message : "Noe gikk galt");
    }
  }, []);
  usePolling(last);

  return (
    <section className="middag">
      <Sidetopp tittel="Middag" />
      <p className="hint">Alle middagene vi har, med score fra dere.</p>
      {feil && <Infoboks type="feil">{feil}</Infoboks>}
      {retter && retter.length === 0 && (
        <p className="hint tomtavle">Det er ingen middager ennå.</p>
      )}
      <ul className="rettliste">
        {retter?.map((r) => (
          <li key={r.id} className="rett-kort">
            <strong className="retttittel">{r.tittel}</strong>
            <Snitt snitt={r.snitt} antall={r.antall} />
            <span className="minscore">
              {r.minSnitt === null ? (
                "Du har ikke gitt stjerner"
              ) : (
                <>
                  Din score: <Score verdi={r.minSnitt} />
                </>
              )}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
