import { useCallback, useState, type FormEvent } from "react";
import { Sidetopp } from "../../design/Sidetopp";
import { Tekstfelt } from "../../design/Felt";
import { Faner } from "../../design/Faner";
import { Infoboks } from "../../design/Infoboks";
import { Knapp } from "../../design/Knapp";
import { useAuth } from "../../app/AuthContext";
import { apiGet, apiPost } from "../../lib/api";
import type { Poengstatus } from "../../lib/types";
import { usePolling } from "../../lib/usePolling";
import { PoengKort } from "../gjoremal/Poeng";
import { EmojiVelger } from "./EmojiVelger";
import { Family } from "../family/Family";
import { KiOppsett } from "../ki/KiOppsett";
import { HvaErNytt } from "./HvaErNytt";
import { Avatar } from "../login/LoginScreen";
import { PIN_LENGDE } from "../login/PinPad";

export function Profile() {
  const { bruker, loggUt } = useAuth();
  const [fane, setFane] = useState("profil");
  const [poeng, setPoeng] = useState<Poengstatus | null>(null);
  const [gammel, setGammel] = useState("");
  const [ny, setNy] = useState("");
  const [melding, setMelding] = useState<{ tekst: string; feil: boolean } | null>(null);
  const lastPoeng = useCallback(async () => {
    try {
      const alle = await apiGet<Poengstatus[]>("/api/gjoremal/poeng");
      setPoeng(alle[0] ?? null);
    } catch {
      // Profilen virker uten poeng
    }
  }, []);
  usePolling(lastPoeng);

  if (!bruker) return null;

  const bytt = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await apiPost("/api/auth/pin", { gammel, ny });
      setGammel("");
      setNy("");
      setMelding({ tekst: "PIN er endret", feil: false });
    } catch (err) {
      setMelding({ tekst: err instanceof Error ? err.message : "Noe gikk galt", feil: true });
    }
  };

  const faner = [
    { id: "profil", navn: "Min profil" },
    ...(bruker.rolle === "forelder"
      ? [
          { id: "familie", navn: "Familie" },
          { id: "ki", navn: "KI" },
        ]
      : []),
    { id: "nytt", navn: "Hva er nytt" },
  ];
  const gyldig = faner.some((f) => f.id === fane) ? fane : "profil";

  return (
    <section className="profil">
      <Sidetopp tittel="Innstillinger" />
      <Faner valg={faner} aktiv={gyldig} onVelg={setFane} etikett="Innstillinger">
        {gyldig === "profil" && (
          <>
            <Avatar bruker={bruker} stor />
            <h3 className="profilnavn">{bruker.visningsnavn}</h3>
            {bruker.rolle === "barn" && poeng && <PoengKort status={poeng} />}
            <Knapp variant="primær" ikon="logg_ut" onClick={() => void loggUt()}>
              Bytt bruker
            </Knapp>
            <details className="sammenleggbar">
              <summary>Velg emoji</summary>
              <EmojiVelger />
            </details>
            <details className="sammenleggbar">
              <summary>Bytt PIN</summary>
              <form className="nyttskjema" onSubmit={bytt}>
                <Tekstfelt
                  etikett="Gammel PIN"
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6} // Eldre PIN-koder kan ha opptil 6 sifre, så de kan byttes til 4
                  value={gammel}
                  onChange={(e) => setGammel(e.target.value.replace(/\D/g, ""))}
                  required
                />
                <Tekstfelt
                  etikett="Ny PIN (4 sifre)"
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={PIN_LENGDE}
                  value={ny}
                  onChange={(e) => setNy(e.target.value.replace(/\D/g, ""))}
                  required
                />
                <Knapp type="submit" ikon="nokkel">
                  Lagre ny PIN
                </Knapp>
              </form>
              {melding && (
                <Infoboks key={melding.tekst} type={melding.feil ? "feil" : "ok"}>
                  {melding.tekst}
                </Infoboks>
              )}
            </details>
          </>
        )}
        {gyldig === "familie" && <Family />}
        {gyldig === "ki" && <KiOppsett />}
        {gyldig === "nytt" && <HvaErNytt />}
      </Faner>
    </section>
  );
}
