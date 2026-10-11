import { useEffect, useState } from "react";
import { useAuth } from "../../app/AuthContext";
import { apiGet } from "../../lib/api";
import { lesbarTekstfarge } from "../../lib/farge";
import type { Bruker } from "../../lib/types";
import { Infoboks } from "../../design/Infoboks";
import { Knapp } from "../../design/Knapp";
import { PIN_LENGDE, PinPad } from "./PinPad";

export function Avatar({ bruker, stor }: { bruker: Bruker; stor?: boolean }) {
  return (
    <span
      className={stor ? "avatar stor" : "avatar"}
      style={{ background: bruker.farge, color: lesbarTekstfarge(bruker.farge) }}
    >
      {bruker.emoji ?? bruker.visningsnavn.slice(0, 1).toUpperCase()}
    </span>
  );
}

export function LoginScreen() {
  const { loggInn } = useAuth();
  const [brukere, setBrukere] = useState<Bruker[] | null>(null);
  const [valgt, setValgt] = useState<Bruker | null>(null);
  const [pin, setPin] = useState("");
  const [feil, setFeil] = useState<string | null>(null);
  const [opptatt, setOpptatt] = useState(false);
  const [lastFeil, setLastFeil] = useState(false);

  useEffect(() => {
    apiGet<Bruker[]>("/api/auth/users")
      .then(setBrukere)
      .catch(() => setLastFeil(true));
  }, []);

  const velg = (b: Bruker | null) => {
    setValgt(b);
    setPin("");
    setFeil(null);
  };

  const prøv = async (ferdigPin: string) => {
    if (!valgt) return;
    setOpptatt(true);
    setFeil(null);
    try {
      await loggInn(valgt.id, ferdigPin);
    } catch (e) {
      setFeil(e instanceof Error ? e.message : "Noe gikk galt");
      setPin("");
    } finally {
      setOpptatt(false);
    }
  };

  if (valgt) {
    return (
      <main className="login">
        <Knapp variant="tekst" ikon="forrige" className="tilbake" onClick={() => velg(null)}>
          Tilbake
        </Knapp>
        <Avatar bruker={valgt} stor />
        <h1>Hei, {valgt.visningsnavn}</h1>
        {feil ? (
          <Infoboks key={feil} type="feil">
            {feil}
          </Infoboks>
        ) : (
          <p className="hint">Tast inn PIN-koden din</p>
        )}
        <PinPad
          lengde={PIN_LENGDE}
          verdi={pin}
          onChange={setPin}
          onFerdig={prøv}
          disabled={opptatt}
        />
      </main>
    );
  }

  return (
    <main className="login">
      <h1>Hvem er du?</h1>
      {lastFeil && <Infoboks type="feil">Får ikke kontakt med tavla. Prøv igjen om litt.</Infoboks>}
      {brukere?.length === 0 && (
        <Infoboks type="info">
          Ingen brukere ennå. Legg dem til med add-user, eller last inn demofamilien med npm run
          seed:demo.
        </Infoboks>
      )}
      <div className="fliser">
        {brukere?.map((b) => (
          <button
            key={b.id}
            type="button"
            className="flis"
            style={{ background: b.farge, color: lesbarTekstfarge(b.farge) }}
            onClick={() => velg(b)}
          >
            <span className="emoji">{b.emoji ?? b.visningsnavn.slice(0, 1).toUpperCase()}</span>
            <span className="navn">{b.visningsnavn}</span>
          </button>
        ))}
      </div>
    </main>
  );
}
