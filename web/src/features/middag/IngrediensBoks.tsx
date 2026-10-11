import { AnimertIkon } from "../../design/AnimertIkon";
import { Infoboks } from "../../design/Infoboks";
import { Knapp } from "../../design/Knapp";
import { useEffect, useRef, useState } from "react";
import { apiGet } from "../../lib/api";
import { langDato, ukenr } from "../../lib/dato";
import type { Rett, Vare } from "../../lib/types";

const normaliser = (navn: string) => navn.trim().replace(/\s+/g, " ").toLocaleLowerCase("nb-NO");

interface Props {
  rett: Rett;
  dato: string;
  /** Får de ingrediensene man vil handle. Tom liste betyr at ingenting legges på handlelisten. */
  onBekreft: (valgte: string[]) => Promise<void>;
  onAvbryt: () => void;
}

/**
 * Boksen som dukker opp når en rett velges for en dag. Alle ingrediensene er krysset av fra start,
 * og man fjerner det man ikke trenger å kjøpe før resten legges på handlelisten.
 */
export function IngrediensBoks({ rett, dato, onBekreft, onAvbryt }: Props) {
  const ingredienser = rett.ingredienser ?? [];
  const [valgt, setValgt] = useState<Set<string>>(() => new Set(ingredienser));
  const [paaLista, setPaaLista] = useState<Set<string>>(new Set());
  const [opptatt, setOpptatt] = useState(false);
  const [feil, setFeil] = useState<string | null>(null);

  // Hvilke av ingrediensene står allerede på handlelisten?
  useEffect(() => {
    let levende = true;
    apiGet<Vare[]>("/api/handleliste")
      .then((varer) => {
        if (levende)
          setPaaLista(new Set(varer.filter((v) => !v.kjopt).map((v) => normaliser(v.navn))));
      })
      .catch(() => undefined);
    return () => {
      levende = false;
    };
  }, []);

  const boks = useRef<HTMLDivElement>(null);
  // Fokus holdes inne i boksen mens den er åpen, og går tilbake dit det var da den lukkes
  const [forrige] = useState(() =>
    document.activeElement instanceof HTMLElement ? document.activeElement : null,
  );
  useEffect(() => () => forrige?.focus(), [forrige]);

  useEffect(() => {
    const taster = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !opptatt) {
        onAvbryt();
        return;
      }
      if (e.key !== "Tab" || !boks.current) return;
      const mulige = [
        ...boks.current.querySelectorAll<HTMLElement>(
          "button:not(:disabled), input:not(:disabled), [href], select:not(:disabled)",
        ),
      ];
      const forste = mulige[0];
      const siste = mulige.at(-1);
      if (!forste || !siste) return;
      if (e.shiftKey && document.activeElement === forste) {
        e.preventDefault();
        siste.focus();
      } else if (!e.shiftKey && document.activeElement === siste) {
        e.preventDefault();
        forste.focus();
      } else if (!boks.current.contains(document.activeElement)) {
        e.preventDefault();
        forste.focus();
      }
    };
    window.addEventListener("keydown", taster);
    return () => window.removeEventListener("keydown", taster);
  }, [onAvbryt, opptatt]);

  const veksle = (navn: string) => {
    const ny = new Set(valgt);
    if (ny.has(navn)) ny.delete(navn);
    else ny.add(navn);
    setValgt(ny);
  };

  const bekreft = async () => {
    setOpptatt(true);
    setFeil(null);
    try {
      await onBekreft(ingredienser.filter((i) => valgt.has(i)));
    } catch (e) {
      setFeil(e instanceof Error ? e.message : "Noe gikk galt");
      setOpptatt(false);
    }
  };

  return (
    <div className="boksbakgrunn" onClick={() => !opptatt && onAvbryt()}>
      <div
        ref={boks}
        className="boks"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ingrediensboks-tittel"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="ingrediensboks-tittel">Hva må handles til {rett.tittel}?</h3>
        <p className="hint">
          {langDato(dato)} (uke {ukenr(dato)}). Fjern det du ikke trenger å kjøpe. Resten legges på
          handlelisten med dato for når det må handles innen.
        </p>
        <div className="boksverktoy">
          <Knapp onClick={() => setValgt(new Set(ingredienser))} disabled={opptatt}>
            Velg alle
          </Knapp>
          <Knapp onClick={() => setValgt(new Set())} disabled={opptatt}>
            Fjern alle
          </Knapp>
        </div>
        <ul className="ingrediensvalg">
          {ingredienser.map((i, nr) => (
            <li key={i}>
              <label>
                <input
                  type="checkbox"
                  checked={valgt.has(i)}
                  onChange={() => veksle(i)}
                  disabled={opptatt}
                  autoFocus={nr === 0}
                />
                <span className={valgt.has(i) ? "rute huket" : "rute"} aria-hidden="true">
                  {valgt.has(i) && <AnimertIkon navn="hake" storrelse="m" spillVedStart={0} />}
                </span>
                <span className="ingrediensnavn">{i}</span>
                {paaLista.has(normaliser(i)) && <small>står allerede på lista</small>}
              </label>
            </li>
          ))}
        </ul>
        {feil && <Infoboks type="feil">{feil}</Infoboks>}
        <div className="handlinger">
          <Knapp onClick={onAvbryt} disabled={opptatt}>
            Avbryt
          </Knapp>
          <Knapp
            variant="primær"
            ikon={valgt.size > 0 ? "handle" : undefined}
            onClick={() => void bekreft()}
            disabled={opptatt}
          >
            {valgt.size > 0
              ? `Legg til ${valgt.size} på handlelisten`
              : "Velg middag uten å handle noe"}
          </Knapp>
        </div>
      </div>
    </div>
  );
}
