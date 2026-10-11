import { Avkrysning, Tekstfelt, Valgfelt } from "../../design/Felt";
import { Infoboks } from "../../design/Infoboks";
import { Knapp } from "../../design/Knapp";
import { useState, type FormEvent } from "react";
import { dagFra, klokkeslett, leggTilDager, leggTilMinutterTid } from "../../lib/dato";
import type { Hendelse, Kalender } from "../../lib/types";

export interface HendelseUt {
  kalenderId: number;
  tittel: string;
  sted: string | null;
  helDag: boolean;
  start: string;
  slutt: string | null;
  gjentas: "ukentlig" | null;
  gjentasTil: string | null;
}

interface Props {
  kalendere: Kalender[];
  /** Avtalen som endres, eller null for en ny. */
  hendelse: Hendelse | null;
  /** Dagen en ny avtale starter på. */
  dato: string;
  onLagre: (data: HendelseUt) => Promise<void>;
  onAvbryt: () => void;
}

/** Skjema for en avtale. Slutt følger starten til man selv har rørt den. Avtalen kan gjentas hver uke. */
export function HendelseSkjema({ kalendere, hendelse, dato, onLagre, onAvbryt }: Props) {
  const h = hendelse;
  // En avtale som gjentas, endres som helhet, så skjemaet viser første gang den skjedde
  const hStart = h?.startOriginal ?? "";
  const hSlutt = h?.sluttOriginal ?? "";
  const [kalenderId, setKalenderId] = useState(h?.kalenderId ?? kalendere[0]?.id ?? 0);
  const [tittel, setTittel] = useState(h?.tittel ?? "");
  const [sted, setSted] = useState(h?.sted ?? "");
  const [helDag, setHelDag] = useState(h?.helDag ?? false);
  const [startDato, setStartDato] = useState(h ? dagFra(hStart) : dato);
  const [startTid, setStartTid] = useState(h && !h.helDag ? klokkeslett(hStart) : "17:00");
  const [sluttDato, setSluttDato] = useState(
    h ? (h.helDag ? leggTilDager(dagFra(hSlutt), -1) : dagFra(hSlutt)) : dato,
  );
  const [sluttTid, setSluttTid] = useState(h && !h.helDag ? klokkeslett(hSlutt) : "18:00");
  const [sluttRort, setSluttRort] = useState(!!h);
  const [gjentas, setGjentas] = useState(!!h?.gjentas);
  const [gjentasTil, setGjentasTil] = useState(h?.gjentasTil ?? "");
  const [opptatt, setOpptatt] = useState(false);
  const [feil, setFeil] = useState<string | null>(null);

  const endreStart = (nyDato: string, nyTid: string) => {
    setStartDato(nyDato);
    setStartTid(nyTid);
    if (!sluttRort) {
      setSluttDato(nyDato);
      setSluttTid(leggTilMinutterTid(nyTid, 60));
    }
  };

  const lagre = async (e: FormEvent) => {
    e.preventDefault();
    setOpptatt(true);
    setFeil(null);
    try {
      await onLagre({
        kalenderId,
        tittel: tittel.trim(),
        sted: sted.trim() || null,
        helDag,
        start: helDag ? startDato : `${startDato}T${startTid}`,
        slutt: helDag ? sluttDato || startDato : `${sluttDato || startDato}T${sluttTid}`,
        gjentas: gjentas ? "ukentlig" : null,
        gjentasTil: gjentas ? gjentasTil : null,
      });
    } catch (err) {
      setFeil(err instanceof Error ? err.message : "Noe gikk galt");
      setOpptatt(false);
    }
  };

  return (
    <form className="nyttskjema hendelseskjema" onSubmit={lagre}>
      <h3>{h ? "Endre avtale" : "Ny avtale"}</h3>
      <Tekstfelt
        etikett="Hva"
        value={tittel}
        onChange={(e) => setTittel(e.target.value)}
        maxLength={80}
        autoFocus
        required
      />
      <Valgfelt
        etikett="Kalender"
        value={kalenderId}
        onChange={(e) => setKalenderId(Number(e.target.value))}
      >
        {kalendere.map((k) => (
          <option key={k.id} value={k.id}>
            {k.navn}
          </option>
        ))}
      </Valgfelt>
      <Avkrysning
        etikett="Hele dagen"
        checked={helDag}
        onChange={(e) => setHelDag(e.target.checked)}
      />
      <div className="tidrad">
        <Tekstfelt
          etikett="Fra"
          type="date"
          value={startDato}
          onChange={(e) => endreStart(e.target.value, startTid)}
          required
        />
        {!helDag && (
          <Tekstfelt
            etikett="Klokka"
            type="time"
            value={startTid}
            onChange={(e) => endreStart(startDato, e.target.value)}
            required
          />
        )}
      </div>
      <div className="tidrad">
        <Tekstfelt
          etikett={helDag ? "Til og med" : "Til"}
          type="date"
          value={sluttDato}
          min={startDato}
          onChange={(e) => {
            setSluttDato(e.target.value);
            setSluttRort(true);
          }}
          required
        />
        {!helDag && (
          <Tekstfelt
            etikett="Klokka"
            type="time"
            value={sluttTid}
            onChange={(e) => {
              setSluttTid(e.target.value);
              setSluttRort(true);
            }}
            required
          />
        )}
      </div>
      <Avkrysning
        etikett="Gjentas hver uke"
        checked={gjentas}
        onChange={(e) => setGjentas(e.target.checked)}
      />
      {gjentas && (
        <Tekstfelt
          etikett="Gjentas til og med"
          hjelp={h?.gjentas ? "Endringer gjelder alle ukene." : undefined}
          type="date"
          value={gjentasTil}
          min={startDato}
          onChange={(e) => setGjentasTil(e.target.value)}
          required
        />
      )}
      <Tekstfelt
        etikett="Sted (valgfritt)"
        value={sted}
        onChange={(e) => setSted(e.target.value)}
        maxLength={80}
      />
      {feil && <Infoboks type="feil">{feil}</Infoboks>}
      <div className="handlinger">
        <Knapp onClick={onAvbryt} disabled={opptatt}>
          Avbryt
        </Knapp>
        <Knapp
          type="submit"
          variant="primær"
          disabled={opptatt || !tittel.trim() || kalendere.length === 0 || (gjentas && !gjentasTil)}
        >
          {h ? "Lagre" : "Legg til"}
        </Knapp>
      </div>
    </form>
  );
}
