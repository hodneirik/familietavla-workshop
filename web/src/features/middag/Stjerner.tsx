import { Ikon } from "../../design/Ikon";

/** 4,3 og ikke 4.33. */
export const formaterSnitt = (n: number): string =>
  String(Math.round(n * 10) / 10).replace(".", ",");

/** Snittet for en rett: «★ 4,3 (7 stemmer)», eller at ingen har stemt ennå. */
export function Snitt({ snitt, antall }: { snitt: number | null; antall: number }) {
  if (snitt === null) return <span className="snitt tom">Ingen stemmer ennå</span>;
  return (
    <span className="snitt">
      <Ikon navn="stjerne" storrelse="s" fylt className="stjerne" /> {formaterSnitt(snitt)}{" "}
      <small>
        ({antall} {antall === 1 ? "stemme" : "stemmer"})
      </small>
    </span>
  );
}

/** Fem stjerner å trykke på. En tom verdi betyr at ingen er valgt ennå. */
export function StjerneVelger({
  verdi,
  onVelg,
}: {
  verdi: number | null;
  onVelg: (stjerner: number) => void;
}) {
  return (
    <div className="stjernevelger" role="radiogroup" aria-label="Gi stjerner fra 1 til 5">
      {[1, 2, 3, 4, 5].map((n) => {
        const fylt = verdi !== null && n <= verdi;
        return (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={verdi === n}
            aria-label={`${n} ${n === 1 ? "stjerne" : "stjerner"}`}
            className={fylt ? "fylt" : ""}
            onClick={() => onVelg(n)}
          >
            <Ikon navn="stjerne" storrelse="xl" fylt={fylt} className="stjerne" />
          </button>
        );
      })}
    </div>
  );
}

/** Stjerner som vises, ikke trykkes på: «3 av 5». */
export function StjerneRekke({ verdi }: { verdi: number }) {
  return (
    <span className="stjernerekke" role="img" aria-label={`${verdi} av 5 stjerner`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Ikon key={n} navn="stjerne" storrelse="s" fylt={n <= verdi} className="stjerne" />
      ))}
    </span>
  );
}

/** Scoren man selv har gitt: «★ 3,5». */
export function Score({ verdi }: { verdi: number }) {
  return (
    <span className="snitt">
      <Ikon navn="stjerne" storrelse="s" fylt className="stjerne" /> {formaterSnitt(verdi)}
    </span>
  );
}
