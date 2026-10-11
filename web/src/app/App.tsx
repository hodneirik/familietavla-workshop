import { useState } from "react";
import { Bunnmeny } from "../design/Bunnmeny";
import { Toppmeny } from "../design/Toppmeny";
import { faner } from "../features/registry";
import { LoginScreen } from "../features/login/LoginScreen";
import { Oppdateringsstripe, useNyVersjon } from "./Oppdatering";
import { useAuth } from "./AuthContext";

export function App() {
  const { bruker, laster } = useAuth();
  const [aktiv, setAktiv] = useState("hjem");
  const nyVersjon = useNyVersjon();
  const oppdater = () => window.location.reload();
  const stripe = <Oppdateringsstripe ny={nyVersjon} onOppdater={oppdater} />;

  if (laster) return <main className="login" aria-busy="true" />;
  if (!bruker)
    return (
      <>
        {stripe}
        <LoginScreen />
      </>
    );

  const synlige = faner.filter((f) => f.paa && f.roller.includes(bruker.rolle));
  const valgt = synlige.find((f) => f.id === aktiv) ?? synlige[0];
  const Innhold = valgt?.komponent;

  return (
    <div className="skall">
      <a className="hopp" href="#innhold">
        Hopp til innholdet
      </a>
      {stripe}
      <Toppmeny bruker={bruker} onProfil={() => setAktiv("meg")} />
      <main className="innhold" id="innhold" tabIndex={-1} key={valgt?.id}>
        {Innhold ? <Innhold /> : null}
      </main>
      <Bunnmeny valg={synlige} aktiv={valgt?.id} onVelg={setAktiv} farge={bruker.farge} />
    </div>
  );
}
