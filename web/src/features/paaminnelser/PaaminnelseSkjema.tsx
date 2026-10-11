import { useEffect, useState, type FormEvent } from "react";
import { Avkrysning, Tekstfelt, Valgfelt } from "../../design/Felt";
import { Infoboks } from "../../design/Infoboks";
import { Knapp } from "../../design/Knapp";
import { apiGet } from "../../lib/api";
import { iDag, leggTilDager } from "../../lib/dato";
import type { BrukerAdmin, Paaminnelse } from "../../lib/types";
import { UKEDAGER } from "./paaminnelser";

/** Det skjemaet sender: enten faste ukedager (eventuelt bare i en periode), eller én dato. */
export interface PaaminnelseUt {
  barnIder: number[];
  tittel: string;
  ukedager?: number[];
  dato?: string;
  fra?: string | null;
  til?: string | null;
}

interface Props {
  /** Påminnelsen som endres, eller null for en ny. En som endres, hører til ett barn og beholder slaget sitt. */
  paaminnelse: Paaminnelse | null;
  onLagre: (data: PaaminnelseUt) => Promise<void>;
  onAvbryt: () => void;
}

type Slag = "fast" | "dag";

/**
 * Skjema for en påminnelse (bare voksne). Den kan gjentas hver uke (gym), gjelde bare en periode
 * (svømming noen uker), eller være én bestemt dag (turdag). En ny kan legges inn for flere barn.
 */
export function PaaminnelseSkjema({ paaminnelse, onLagre, onAvbryt }: Props) {
  const [tittel, setTittel] = useState(paaminnelse?.tittel ?? "");
  const [slag, setSlag] = useState<Slag>(paaminnelse?.dato ? "dag" : "fast");
  const [dager, setDager] = useState<number[]>(
    paaminnelse?.ukedag != null ? [paaminnelse.ukedag] : [],
  );
  const [dato, setDato] = useState(paaminnelse?.dato ?? leggTilDager(iDag(), 1));
  const [medPeriode, setMedPeriode] = useState(!!(paaminnelse?.fra || paaminnelse?.til));
  const [fra, setFra] = useState(paaminnelse?.fra ?? iDag());
  const [til, setTil] = useState(paaminnelse?.til ?? leggTilDager(iDag(), 28));
  const [barn, setBarn] = useState<BrukerAdmin[]>([]);
  const [valgte, setValgte] = useState<number[]>([]);
  const [opptatt, setOpptatt] = useState(false);
  const [feil, setFeil] = useState<string | null>(null);
  const endrer = paaminnelse !== null;

  useEffect(() => {
    if (paaminnelse) return;
    apiGet<BrukerAdmin[]>("/api/users")
      .then((alle) => {
        const b = alle.filter((u) => u.rolle === "barn" && u.aktiv);
        setBarn(b);
        setValgte(b.map((u) => u.id));
      })
      .catch((e: Error) => setFeil(e.message));
  }, [paaminnelse]);

  const veksle = (liste: number[], sett: (v: number[]) => void, id: number) =>
    sett(liste.includes(id) ? liste.filter((v) => v !== id) : [...liste, id].sort());

  const lagre = async (e: FormEvent) => {
    e.preventDefault();
    setOpptatt(true);
    setFeil(null);
    try {
      const felles = { barnIder: endrer ? [paaminnelse.barn.id] : valgte, tittel: tittel.trim() };
      await onLagre(
        slag === "dag"
          ? { ...felles, dato }
          : {
              ...felles,
              ukedager: dager,
              fra: medPeriode ? fra : null,
              til: medPeriode ? til : null,
            },
      );
    } catch (err) {
      setFeil(err instanceof Error ? err.message : "Noe gikk galt");
      setOpptatt(false);
    }
  };

  const mangler =
    !tittel.trim() ||
    (!endrer && valgte.length === 0) ||
    (slag === "fast" ? dager.length === 0 || (medPeriode && (!fra || !til || til < fra)) : !dato);

  return (
    <form className="nyttskjema" onSubmit={lagre}>
      <h3>{endrer ? "Endre påminnelse" : "Ny påminnelse"}</h3>
      <Tekstfelt
        etikett="Hva skal barnet huske?"
        value={tittel}
        onChange={(e) => setTittel(e.target.value)}
        maxLength={60}
        placeholder="F.eks. Gym, Bibliotek eller Turdag"
        autoFocus
        required
      />
      {!endrer && (
        <Valgfelt etikett="Når?" value={slag} onChange={(e) => setSlag(e.target.value as Slag)}>
          <option value="fast">Hver uke</option>
          <option value="dag">Bare én bestemt dag</option>
        </Valgfelt>
      )}
      {slag === "fast" ? (
        <>
          <fieldset className="barnevalg">
            <legend>{endrer ? "Ukedag" : "Hver uke på"}</legend>
            {UKEDAGER.map((navn, i) => (
              <Avkrysning
                key={navn}
                etikett={navn}
                checked={dager.includes(i)}
                onChange={() => (endrer ? setDager([i]) : veksle(dager, setDager, i))}
              />
            ))}
          </fieldset>
          <Avkrysning
            etikett="Bare i en periode (for eksempel svømming noen uker)"
            checked={medPeriode}
            onChange={(e) => setMedPeriode(e.target.checked)}
          />
          {medPeriode && (
            <div className="tidrad">
              <Tekstfelt
                etikett="Første dag"
                type="date"
                value={fra}
                onChange={(e) => setFra(e.target.value)}
                required
              />
              <Tekstfelt
                etikett="Siste dag"
                type="date"
                value={til}
                min={fra}
                onChange={(e) => setTil(e.target.value)}
                required
              />
            </div>
          )}
        </>
      ) : (
        <Tekstfelt
          etikett="Dato"
          type="date"
          value={dato}
          onChange={(e) => setDato(e.target.value)}
          required
        />
      )}
      {!endrer && (
        <fieldset className="barnevalg">
          <legend>Til</legend>
          {barn.map((b) => (
            <Avkrysning
              key={b.id}
              etikett={`${b.emoji ?? "🙂"} ${b.visningsnavn}`}
              checked={valgte.includes(b.id)}
              onChange={() => veksle(valgte, setValgte, b.id)}
            />
          ))}
        </fieldset>
      )}
      {feil && <Infoboks type="feil">{feil}</Infoboks>}
      <div className="handlinger">
        <Knapp onClick={onAvbryt} disabled={opptatt}>
          Avbryt
        </Knapp>
        <Knapp type="submit" variant="primær" disabled={opptatt || mangler}>
          {endrer ? "Lagre" : "Legg til"}
        </Knapp>
      </div>
    </form>
  );
}
