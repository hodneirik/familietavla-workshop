import { useAuth } from "../../app/AuthContext";
import { useBred } from "../../lib/useBred";
import { Oppslag } from "../oppslag/Oppslag";
import { Vaer } from "../vaer/Vaer";
import { Kommende } from "./Kommende";

/**
 * Hjem: vær, oppslagstavla og de neste dagene. På telefonen kommer dagens kort først, så tavla, så resten av
 * dagene. På en bred skjerm (iPaden) står tavla til venstre og alle dagene til høyre, så mer får plass uten å bla.
 */
export function Hjem() {
  const { bruker } = useAuth();
  const bred = useBred();
  const roller = {
    kanGiStjerner: bruker?.rolle === "barn",
    forelder: bruker?.rolle === "forelder",
    besteforelder: bruker?.rolle === "besteforelder",
  };
  if (bred) {
    return (
      <div className="hjem hjem--bred">
        <div className="hjem__venstre">
          <Vaer />
          <Oppslag />
        </div>
        <div className="hjem__hoyre">
          <Kommende {...roller} />
        </div>
      </div>
    );
  }
  return (
    <div className="hjem">
      <Vaer />
      <Kommende {...roller} etterIDag={<Oppslag />} />
    </div>
  );
}
