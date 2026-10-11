import type { Paaminnelse } from "../../lib/types";
import { grupperPaaminnelser } from "./paaminnelser";

/**
 * Påminnelsene på en dag, smått og samlet i én linje under dagens overskrift: «Gym · Elias, Nelly».
 * Voksne ser hvem de gjelder, barnet ser bare sine egne og trenger ikke navn.
 */
export function PaaminnelseLinje({
  paaminnelser,
  medBarn,
}: {
  paaminnelser: Paaminnelse[];
  medBarn: boolean;
}) {
  if (paaminnelser.length === 0) return null;
  return (
    <ul className="paaminnelser" aria-label="Påminnelser">
      {grupperPaaminnelser(paaminnelser, medBarn).map((g) => (
        <li key={g.tittel}>
          <strong>{g.tittel}</strong>
          {g.barn.length > 0 && <span className="paaminnelser__barn"> · {g.barn.join(", ")}</span>}
        </li>
      ))}
    </ul>
  );
}
