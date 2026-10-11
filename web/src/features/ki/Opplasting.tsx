import { Avkrysning, Valgfelt } from "../../design/Felt";
import { Ikon } from "../../design/Ikon";
import { Knapp } from "../../design/Knapp";
import { ukeEtikett, ukevalg } from "./forslagLogikk";
import type { Pdf } from "./useKi";

interface Props {
  pdf: Pdf | null;
  uke: string;
  idag: string;
  barn: { id: number; navn: string; klasse: string | null }[];
  barnIder: number[];
  aktiv: boolean;
  opptatt: boolean;
  onFil: (fil: File | null) => void;
  onUke: (uke: string) => void;
  onBarn: (ider: number[]) => void;
  onStart: () => void;
}

/** Første steg: velg PDF-en, uka og hvilke barn planen gjelder. */
export function Opplasting({
  pdf,
  uke,
  idag,
  barn,
  barnIder,
  aktiv,
  opptatt,
  onFil,
  onUke,
  onBarn,
  onStart,
}: Props) {
  const veksle = (id: number) =>
    onBarn(barnIder.includes(id) ? barnIder.filter((b) => b !== id) : [...barnIder, id]);
  return (
    <form
      className="nyttskjema kiopplasting"
      onSubmit={(e) => {
        e.preventDefault();
        onStart();
      }}
    >
      <p className="hint">
        Last ned PDF-en fra skolens nettside og velg den her. Den sendes til Anthropic, som lager
        KI-en, og lagres ikke i appen. Ingen navn på barna sendes med.
      </p>
      <div className="felt">
        <span className="felt__etikett">Ukeplanen (PDF)</span>
        {/* Den innebygde filvelgeren er på engelsk, så den skjules bak en norsk knapp */}
        <input
          id="ki-fil"
          className="skjultfil"
          type="file"
          accept="application/pdf,.pdf"
          onChange={(e) => onFil(e.target.files?.[0] ?? null)}
          disabled={!aktiv || opptatt}
        />
        <label htmlFor="ki-fil" className="knapp knapp--sekundær filknapp">
          <Ikon navn="fil" storrelse="s" /> {pdf ? "Velg en annen PDF" : "Velg PDF"}
        </label>
        {pdf ? (
          <span className="hint">Valgt: {pdf.navn}</span>
        ) : (
          <span className="hint">Ingen fil valgt ennå.</span>
        )}
      </div>
      <Valgfelt
        etikett="Hvilken uke gjelder planen?"
        value={uke}
        onChange={(e) => onUke(e.target.value)}
      >
        {ukevalg(idag).map((u) => (
          <option key={u} value={u}>
            {ukeEtikett(u)}
          </option>
        ))}
      </Valgfelt>
      <fieldset className="barnevalg">
        <legend>Hvem gjelder planen?</legend>
        {barn.map((b) => (
          <Avkrysning
            key={b.id}
            etikett={`${b.navn}${b.klasse ? ` (${b.klasse})` : ""}`}
            checked={barnIder.includes(b.id)}
            onChange={() => veksle(b.id)}
          />
        ))}
        {barn.some((b) => !b.klasse) && (
          <p className="hint">
            Barn uten klasse kan få spørsmål om klassen. Du kan legge den inn under Innstillinger.
          </p>
        )}
      </fieldset>
      <Knapp
        type="submit"
        variant="primær"
        storrelse="stor"
        ikon="nytt"
        disabled={!aktiv || opptatt || !pdf || barnIder.length === 0}
      >
        Les ukeplanen
      </Knapp>
    </form>
  );
}
