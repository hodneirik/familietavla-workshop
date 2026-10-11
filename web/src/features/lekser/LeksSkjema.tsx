import { useEffect, useState, type FormEvent } from "react";
import { Avkrysning, Tekstfelt, Tekstomrade } from "../../design/Felt";
import { Infoboks } from "../../design/Infoboks";
import { Knapp } from "../../design/Knapp";
import { apiGet } from "../../lib/api";
import { iDag, leggTilDager } from "../../lib/dato";
import type { BrukerAdmin, Lekse } from "../../lib/types";

const FAG = [
  "Norsk",
  "Matte",
  "Engelsk",
  "Naturfag",
  "Samfunnsfag",
  "KRLE",
  "Musikk",
  "Kunst og håndverk",
  "Mat og helse",
  "Gym",
];

export interface LekseUt {
  barnIder: number[];
  tittel: string;
  fag: string | null;
  fritekst: string | null;
  frist: string;
}

interface Props {
  /** Leksa som endres, eller null for en ny. En lekse som endres, hører til ett barn. */
  lekse: Lekse | null;
  onLagre: (data: LekseUt) => Promise<void>;
  onAvbryt: () => void;
}

/** Skjema for en lekse (bare voksne). En ny lekse kan legges inn for flere barn på en gang. */
export function LeksSkjema({ lekse, onLagre, onAvbryt }: Props) {
  const [tittel, setTittel] = useState(lekse?.tittel ?? "");
  const [fag, setFag] = useState(lekse?.fag ?? "");
  const [fritekst, setFritekst] = useState(lekse?.fritekst ?? "");
  const [frist, setFrist] = useState(lekse?.frist ?? leggTilDager(iDag(), 1));
  const [barn, setBarn] = useState<BrukerAdmin[]>([]);
  const [valgte, setValgte] = useState<number[]>([]);
  const [opptatt, setOpptatt] = useState(false);
  const [feil, setFeil] = useState<string | null>(null);

  useEffect(() => {
    if (lekse) return;
    apiGet<BrukerAdmin[]>("/api/users")
      .then((alle) => {
        const b = alle.filter((u) => u.rolle === "barn" && u.aktiv);
        setBarn(b);
        setValgte(b.map((u) => u.id));
      })
      .catch((e: Error) => setFeil(e.message));
  }, [lekse]);

  const veksle = (id: number) =>
    setValgte(valgte.includes(id) ? valgte.filter((v) => v !== id) : [...valgte, id]);

  const lagre = async (e: FormEvent) => {
    e.preventDefault();
    setOpptatt(true);
    setFeil(null);
    try {
      await onLagre({
        barnIder: lekse ? [lekse.barn.id] : valgte,
        tittel: tittel.trim(),
        fag: fag.trim() || null,
        fritekst: fritekst.trim() || null,
        frist,
      });
    } catch (err) {
      setFeil(err instanceof Error ? err.message : "Noe gikk galt");
      setOpptatt(false);
    }
  };

  const datalist = "leksefag";
  return (
    <form className="nyttskjema lekseskjema" onSubmit={lagre}>
      <h3>{lekse ? "Endre lekse" : "Ny lekse"}</h3>
      <Tekstfelt
        etikett="Tittel"
        value={tittel}
        onChange={(e) => setTittel(e.target.value)}
        maxLength={120}
        placeholder="F.eks. Les side 40 til 45"
        autoFocus
        required
      />
      <Tekstfelt
        etikett="Fag (valgfritt)"
        value={fag}
        onChange={(e) => setFag(e.target.value)}
        maxLength={40}
        list={datalist}
      />
      <datalist id={datalist}>
        {FAG.map((f) => (
          <option key={f} value={f} />
        ))}
      </datalist>
      <Tekstomrade
        etikett="Fritekst (valgfritt)"
        hjelp="Mer om hva som skal gjøres, for eksempel sider, oppgaver eller hva som skal med."
        value={fritekst}
        onChange={(e) => setFritekst(e.target.value)}
        maxLength={1000}
        rows={4}
      />
      <Tekstfelt
        etikett="Frist"
        type="date"
        value={frist}
        onChange={(e) => setFrist(e.target.value)}
        required
      />
      {!lekse && (
        <fieldset className="barnevalg">
          <legend>Til</legend>
          {barn.map((b) => (
            <Avkrysning
              key={b.id}
              etikett={`${b.emoji ?? "🙂"} ${b.visningsnavn}`}
              checked={valgte.includes(b.id)}
              onChange={() => veksle(b.id)}
            />
          ))}
        </fieldset>
      )}
      {feil && <Infoboks type="feil">{feil}</Infoboks>}
      <div className="handlinger">
        <Knapp onClick={onAvbryt} disabled={opptatt}>
          Avbryt
        </Knapp>
        <Knapp
          type="submit"
          variant="primær"
          disabled={opptatt || !tittel.trim() || !frist || (!lekse && valgte.length === 0)}
        >
          {lekse ? "Lagre" : "Legg til"}
        </Knapp>
      </div>
    </form>
  );
}
