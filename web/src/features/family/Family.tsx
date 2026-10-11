import { Tekstfelt, Valgfelt } from "../../design/Felt";
import { Ikon } from "../../design/Ikon";
import { Infoboks } from "../../design/Infoboks";
import { Knapp } from "../../design/Knapp";
import { Merke } from "../../design/Merke";
import { lesbarTekstfarge } from "../../lib/farge";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useAuth } from "../../app/AuthContext";
import { apiGet, apiPatch, apiPost } from "../../lib/api";
import type { Bruker, BrukerAdmin, Rolle } from "../../lib/types";
import { PROFILFARGER, STANDARD_PROFILFARGE } from "../../lib/profilfarger";
import { Avatar } from "../login/LoginScreen";
import { PIN_LENGDE } from "../login/PinPad";

const ROLLENAVN: Record<Rolle, string> = {
  forelder: "Forelder",
  barn: "Barn",
  besteforelder: "Besteforeldre",
};

export function Family() {
  const { bruker, oppdaterBruker } = useAuth();
  const [brukere, setBrukere] = useState<BrukerAdmin[]>([]);
  const [melding, setMelding] = useState<{ tekst: string; feil: boolean } | null>(null);
  const [nullstill, setNullstill] = useState<number | null>(null);
  const [endrerNavn, setEndrerNavn] = useState<number | null>(null);
  const [nyttNavn, setNyttNavn] = useState("");
  const [nyPin, setNyPin] = useState("");
  const [navn, setNavn] = useState("");
  const [rolle, setRolle] = useState<Rolle>("barn");
  const [farge, setFarge] = useState<string>(STANDARD_PROFILFARGE);
  const [emoji, setEmoji] = useState("");
  const [pin, setPin] = useState("");

  const last = useCallback(() => apiGet<BrukerAdmin[]>("/api/users").then(setBrukere), []);
  useEffect(() => {
    last().catch((e: Error) => setMelding({ tekst: e.message, feil: true }));
  }, [last]);

  const utfør = async (jobb: () => Promise<unknown>, ok: string) => {
    try {
      await jobb();
      setMelding({ tekst: ok, feil: false });
      await last();
    } catch (e) {
      setMelding({ tekst: e instanceof Error ? e.message : "Noe gikk galt", feil: true });
    }
  };

  const opprett = (e: FormEvent) => {
    e.preventDefault();
    void utfør(async () => {
      await apiPost("/api/users", { visningsnavn: navn, rolle, farge, emoji: emoji || null, pin });
      setNavn("");
      setEmoji("");
      setPin("");
    }, "Familiemedlem lagt til");
  };

  return (
    <section className="familie">
      {melding && (
        <Infoboks key={melding.tekst} type={melding.feil ? "feil" : "ok"}>
          {melding.tekst}
        </Infoboks>
      )}
      <ul className="brukerliste">
        {brukere.map((b) => (
          <li key={b.id} className={b.aktiv ? "" : "inaktiv"}>
            <Avatar bruker={b} />
            <span className="info">
              <strong>{b.visningsnavn}</strong>
              <span className="rolle">
                <Merke tone={b.rolle === "forelder" ? "gronn" : "skifer"}>
                  {ROLLENAVN[b.rolle]}
                </Merke>
                {!b.aktiv && <Merke>Deaktivert</Merke>}
              </span>
            </span>
            <span className="handlinger">
              <Knapp
                ikon="rediger"
                onClick={() => {
                  setNullstill(null);
                  setNyttNavn(b.visningsnavn);
                  setEndrerNavn(endrerNavn === b.id ? null : b.id);
                }}
                aria-expanded={endrerNavn === b.id}
              >
                Endre navn
              </Knapp>
              <Knapp
                ikon="nokkel"
                onClick={() => {
                  setEndrerNavn(null);
                  setNullstill(nullstill === b.id ? null : b.id);
                }}
              >
                Ny PIN
              </Knapp>
              <Knapp
                variant={b.aktiv ? "fare" : "sekundær"}
                onClick={() =>
                  utfør(
                    () => apiPatch(`/api/users/${b.id}`, { aktiv: !b.aktiv }),
                    b.aktiv ? "Deaktivert" : "Aktivert",
                  )
                }
              >
                {b.aktiv ? "Deaktiver" : "Aktiver"}
              </Knapp>
            </span>
            {endrerNavn === b.id && (
              <form
                className="pinskjema"
                onSubmit={(e) => {
                  e.preventDefault();
                  void utfør(async () => {
                    const oppdatert = await apiPatch<Bruker>(`/api/users/${b.id}`, {
                      visningsnavn: nyttNavn.trim(),
                    });
                    // Heter man noe annet selv, skal navnet øverst på siden følge med med en gang
                    if (bruker && oppdatert.id === bruker.id)
                      oppdaterBruker({ ...bruker, ...oppdatert });
                    setEndrerNavn(null);
                  }, `Navnet er endret til ${nyttNavn.trim()}`);
                }}
              >
                <Tekstfelt
                  etikett={`Nytt navn for ${b.visningsnavn}`}
                  value={nyttNavn}
                  onChange={(e) => setNyttNavn(e.target.value)}
                  maxLength={40}
                  required
                  autoFocus
                />
                <Knapp
                  type="submit"
                  variant="primær"
                  disabled={!nyttNavn.trim() || nyttNavn.trim() === b.visningsnavn}
                >
                  Lagre
                </Knapp>
              </form>
            )}
            {nullstill === b.id && (
              <form
                className="pinskjema"
                onSubmit={(e) => {
                  e.preventDefault();
                  void utfør(async () => {
                    await apiPost(`/api/users/${b.id}/reset-pin`, { pin: nyPin });
                    setNyPin("");
                    setNullstill(null);
                  }, `Ny PIN satt for ${b.visningsnavn}`);
                }}
              >
                <Tekstfelt
                  etikett={`Ny PIN for ${b.visningsnavn}`}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={PIN_LENGDE}
                  placeholder="4 sifre"
                  value={nyPin}
                  onChange={(e) => setNyPin(e.target.value.replace(/\D/g, ""))}
                  autoFocus
                />
                <Knapp type="submit" variant="primær">
                  Lagre
                </Knapp>
              </form>
            )}
          </li>
        ))}
      </ul>

      <details className="sammenleggbar">
        <summary>Legg til familiemedlem</summary>
        <form className="nyttskjema" onSubmit={opprett}>
          <Tekstfelt
            etikett="Navn"
            value={navn}
            onChange={(e) => setNavn(e.target.value)}
            maxLength={40}
            required
          />
          <Valgfelt
            etikett="Rolle"
            hjelp="Besteforeldre kan se, og lage og godkjenne sine egne gjøremål. Ingenting annet."
            value={rolle}
            onChange={(e) => setRolle(e.target.value as Rolle)}
          >
            <option value="barn">Barn</option>
            <option value="forelder">Forelder</option>
            <option value="besteforelder">Besteforeldre</option>
          </Valgfelt>
          <Tekstfelt
            etikett="Emoji (profilbildet)"
            value={emoji}
            onChange={(e) => setEmoji(e.target.value)}
            maxLength={8}
            placeholder="🙂"
          />
          <Tekstfelt
            etikett="PIN (4 sifre)"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={PIN_LENGDE}
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
            required
          />
          <div className="fargevalg" role="radiogroup" aria-label="Farge">
            {PROFILFARGER.map((f) => (
              <button
                key={f.verdi}
                type="button"
                role="radio"
                aria-checked={f.verdi === farge}
                className={f.verdi === farge ? "valgt" : ""}
                style={{ background: f.verdi, color: lesbarTekstfarge(f.verdi) }}
                onClick={() => setFarge(f.verdi)}
                aria-label={f.navn}
                title={f.navn}
              >
                {f.verdi === farge && <Ikon navn="hake" storrelse="m" />}
              </button>
            ))}
          </div>
          <Knapp type="submit" variant="primær" ikon="legg_til">
            Legg til
          </Knapp>
        </form>
      </details>
    </section>
  );
}
