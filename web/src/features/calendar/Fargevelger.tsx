import { AnimertIkon } from "../../design/AnimertIkon";
import { Ikon } from "../../design/Ikon";
import { lesbarTekstfarge } from "../../lib/farge";

/** Fargene i designsystemet først, så noen tydeligere for kalendere som må skilles fra hverandre. */
const FORSLAG = [
  { verdi: "#82b797", navn: "Grønn" },
  { verdi: "#b4cdb0", navn: "Salvie" },
  { verdi: "#e6d8b0", navn: "Sand" },
  { verdi: "#cda89a", navn: "Leire" },
  { verdi: "#889cb0", navn: "Skifer" },
  { verdi: "#4f8cff", navn: "Blå" },
  { verdi: "#e8579a", navn: "Rosa" },
  { verdi: "#ff7a59", navn: "Oransje" },
];

/** Noen ferdige farger, og en fri fargevelger for alle andre. */
export function Fargevelger({
  verdi,
  onChange,
}: {
  verdi: string;
  onChange: (farge: string) => void;
}) {
  const er = (f: string) => f.toLowerCase() === verdi.toLowerCase();
  const egen = !FORSLAG.some((f) => er(f.verdi));
  return (
    <div className="fargevalg" role="radiogroup" aria-label="Farge">
      {FORSLAG.map((f) => (
        <button
          key={f.verdi}
          type="button"
          role="radio"
          aria-checked={er(f.verdi)}
          aria-label={f.navn}
          title={f.navn}
          className={er(f.verdi) ? "valgt" : ""}
          style={{ background: f.verdi, color: lesbarTekstfarge(f.verdi) }}
          onClick={() => onChange(f.verdi)}
        >
          {er(f.verdi) && <Ikon navn="hake" storrelse="m" />}
        </button>
      ))}
      <label
        className={egen ? "egenfarge valgt" : "egenfarge"}
        title="Velg en annen farge"
        style={egen ? { background: verdi, color: lesbarTekstfarge(verdi) } : undefined}
      >
        <input
          type="color"
          value={verdi}
          onChange={(e) => onChange(e.target.value)}
          aria-label="Velg egen farge"
        />
        {egen ? <Ikon navn="hake" storrelse="m" /> : <AnimertIkon navn="palett" storrelse="m" />}
      </label>
    </div>
  );
}
