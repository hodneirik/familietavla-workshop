import { useState, type FormEvent } from "react";
import { Tekstfelt, Tekstomrade, Valgfelt } from "../../design/Felt";
import { Infoboks } from "../../design/Infoboks";
import { Knapp } from "../../design/Knapp";
import type { KiInnstillingerSvar } from "./typer";

interface Props {
  innst: KiInnstillingerSvar;
  onLagre: (data: {
    barn: { barnId: number; klasse: string | null }[];
    regler: string;
    standardKalenderId: number | null;
    voksne: number;
    middagRegler: string;
  }) => Promise<void>;
}

/** Faste opplysninger KI-en får hver gang: klasse per barn, regler og kalenderen skoleavtaler havner i. */
export function KiInnstillinger({ innst, onLagre }: Props) {
  const [klasser, setKlasser] = useState<Record<number, string>>(() =>
    Object.fromEntries(innst.barn.map((b) => [b.id, b.klasse ?? ""])),
  );
  const [regler, setRegler] = useState(innst.regler);
  const [middagRegler, setMiddagRegler] = useState(innst.middagRegler);
  const [voksne, setVoksne] = useState(String(innst.voksne));
  const [kalender, setKalender] = useState<number | null>(innst.standardKalenderId);
  const [opptatt, setOpptatt] = useState(false);
  const [melding, setMelding] = useState<{ tekst: string; feil: boolean } | null>(null);

  const lagre = async (e: FormEvent) => {
    e.preventDefault();
    setOpptatt(true);
    setMelding(null);
    try {
      await onLagre({
        barn: innst.barn.map((b) => ({ barnId: b.id, klasse: klasser[b.id]?.trim() || null })),
        regler,
        middagRegler,
        standardKalenderId: kalender,
        voksne: Math.min(8, Math.max(1, Math.round(Number(voksne)) || 1)),
      });
      setMelding({ tekst: "Innstillingene er lagret", feil: false });
    } catch (err) {
      setMelding({ tekst: err instanceof Error ? err.message : "Noe gikk galt", feil: true });
    } finally {
      setOpptatt(false);
    }
  };

  return (
    <form className="nyttskjema kiinnstillinger" onSubmit={lagre}>
      <h3>Innstillinger for KI</h3>
      <p className="hint">
        Dette sendes sammen med hver plan. Barna heter «barn A» og «barn B» for KI-en: navn byttes
        ut før noe sendes. PDF-en kan likevel inneholde navn, og den sendes til Anthropic.
      </p>
      {innst.barn.map((b) => (
        <Tekstfelt
          key={b.id}
          etikett={`Klasse for ${b.navn}`}
          hjelp="For eksempel 5A. Trinnet leses ut fra tallet."
          value={klasser[b.id] ?? ""}
          onChange={(e) => setKlasser({ ...klasser, [b.id]: e.target.value })}
          maxLength={4}
        />
      ))}
      <Tekstfelt
        etikett="Voksne som spiser middag"
        hjelp={`Brukes til mengder og porsjoner når KI-en foreslår middag. Barna telles fra familien (${innst.barn.length}).`}
        type="number"
        inputMode="numeric"
        min={1}
        max={8}
        value={voksne}
        onChange={(e) => setVoksne(e.target.value)}
      />
      <Tekstomrade
        etikett="Faste regler for ukeplanen"
        hjelp="Skriv for eksempel: «Legg gym og turdager i kalenderen. Hopp over SFO.» Du kan skrive navn, de byttes ut."
        value={regler}
        rows={4}
        maxLength={2000}
        onChange={(e) => setRegler(e.target.value)}
      />
      <Tekstomrade
        etikett="Faste regler for middag"
        hjelp="Brukes når KI-en foreslår middag og nye retter. For eksempel: «Ingen sopp. Fisk minst én gang i uka.» Reglene for ukeplanen over sendes ikke dit."
        value={middagRegler}
        rows={3}
        maxLength={1000}
        onChange={(e) => setMiddagRegler(e.target.value)}
      />
      <Valgfelt
        etikett="Kalender for skoleavtaler"
        hjelp="Brukes når KI-en ikke vet hvilken kalender en avtale skal i."
        value={kalender ?? ""}
        onChange={(e) => setKalender(e.target.value ? Number(e.target.value) : null)}
      >
        <option value="">Spør meg hver gang</option>
        {innst.kalendere.map((k) => (
          <option key={k.id} value={k.id}>
            {k.navn}
          </option>
        ))}
      </Valgfelt>
      {melding && <Infoboks type={melding.feil ? "feil" : "ok"}>{melding.tekst}</Infoboks>}
      <Knapp type="submit" variant="primær" disabled={opptatt}>
        Lagre innstillinger
      </Knapp>
    </form>
  );
}
