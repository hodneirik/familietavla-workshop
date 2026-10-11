import { useEffect, useState } from "react";
import { AnimertIkon } from "../../design/AnimertIkon";
import { IkonKnapp } from "../../design/Knapp";
import { apiDelete, apiPatch, apiPost } from "../../lib/api";
import { kortDato, kortUkedag } from "../../lib/dato";
import type { Lekse } from "../../lib/types";
import { LeksSkjema, type LekseUt } from "./LeksSkjema";

interface Props {
  l: Lekse;
  /** Foreldre: knapper for å endre og slette, og hvem leksa er til. */
  forelder: boolean;
  /** Besteforeldre ser leksene, men kan ikke krysse av eller endre. */
  bareLese?: boolean;
  /** Uten knapper for å endre og slette (i «De neste dagene», som bare er en oversikt). */
  utenHandlinger?: boolean;
  /** Viser fristen i raden (i ukelista og fanen), ikke på selve dagen. */
  visFrist?: boolean;
  forfalt?: boolean;
  /** Kalles etter at noe er endret, så listene lastes på nytt. */
  onEndret: () => Promise<void>;
  onFeil: (melding: string) => void;
}

/** En lekse med en boks som krysses av når den er gjort. Voksne kan også endre og slette. */
export function LekseRad({
  l,
  forelder,
  bareLese,
  utenHandlinger,
  visFrist,
  forfalt,
  onEndret,
  onFeil,
}: Props) {
  const [endrer, setEndrer] = useState(false);
  // Boksen svarer med en gang, mens serveren bekrefter. Avviser serveren, lastes listene på nytt.
  const [valgt, setValgt] = useState<boolean | null>(null);
  useEffect(() => setValgt(null), [l.gjort]);
  const gjort = valgt ?? l.gjort;

  const kryss = async () => {
    setValgt(!gjort);
    try {
      await apiPost(`/api/lekser/${l.id}/${gjort ? "ugjort" : "gjort"}`);
      await onEndret();
    } catch (e) {
      onFeil(e instanceof Error ? e.message : "Noe gikk galt");
      await onEndret();
    }
  };
  const slett = async () => {
    if (!window.confirm(`Slette leksa «${l.tittel}» til ${l.barn.visningsnavn}?`)) return;
    try {
      await apiDelete(`/api/lekser/${l.id}`);
      await onEndret();
    } catch (e) {
      onFeil(e instanceof Error ? e.message : "Noe gikk galt");
    }
  };
  const lagre = async (data: LekseUt) => {
    await apiPatch(`/api/lekser/${l.id}`, {
      tittel: data.tittel,
      fag: data.fag,
      fritekst: data.fritekst,
      frist: data.frist,
    });
    setEndrer(false);
    await onEndret();
  };

  if (endrer) {
    return (
      <li className="lekse-skjema">
        <LeksSkjema lekse={l} onLagre={lagre} onAvbryt={() => setEndrer(false)} />
      </li>
    );
  }

  const info = [
    forelder || bareLese ? `${l.barn.emoji ?? "🙂"} ${l.barn.visningsnavn}` : null,
    visFrist ? `frist ${kortUkedag(l.frist).toLowerCase()} ${kortDato(l.frist)}` : null,
  ].filter(Boolean);

  return (
    <li
      className={gjort ? "hendelse lekse gjort" : "hendelse lekse"}
      style={{ borderLeftColor: l.barn.farge }}
    >
      <label className="avkrysning lekse__vel">
        <input type="checkbox" checked={gjort} disabled={bareLese} onChange={() => void kryss()} />
        <span className={gjort ? "rute huket" : "rute"} aria-hidden="true">
          {gjort && <AnimertIkon navn="hake" storrelse="m" spillVedStart={0} />}
        </span>
        <span className="hendelsetekst">
          <strong>
            {l.tittel}
            {l.fag && <span className="lekse__fag"> ({l.fag})</span>}
          </strong>
          {l.fritekst && <span className="lekse__fritekst">{l.fritekst}</span>}
          {(info.length > 0 || forfalt) && (
            <span className="hendelsetid">
              {forfalt && <span className="forfalt">Forfalt. </span>}
              {info.join(" · ")}
            </span>
          )}
        </span>
      </label>
      {forelder && !utenHandlinger && (
        <span className="handlinger">
          <IkonKnapp
            ikon="rediger"
            tittel={`Endre ${l.tittel}`}
            variant="tekst"
            onClick={() => setEndrer(true)}
          />
          <IkonKnapp
            ikon="slett"
            tittel={`Slett ${l.tittel}`}
            variant="tekst"
            onClick={() => void slett()}
          />
        </span>
      )}
    </li>
  );
}
