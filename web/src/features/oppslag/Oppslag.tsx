import { Ikon } from "../../design/Ikon";
import { Sidetopp } from "../../design/Sidetopp";
import { Infoboks } from "../../design/Infoboks";
import { Knapp } from "../../design/Knapp";
import { useCallback, useState, type FormEvent } from "react";
import { apiDelete, apiGet, apiPatch, apiPost } from "../../lib/api";
import { LAPPFARGER, type Lapp, type Lappfarge } from "../../lib/types";
import { usePolling } from "../../lib/usePolling";

const MAKS_TEKST = 280;

function nårSkrevet(iso: string): string {
  const d = new Date(iso);
  const min = Math.floor((Date.now() - d.getTime()) / 60_000);
  if (min < 1) return "nå";
  if (min < 60) return `${min} min siden`;
  const tid = d.toLocaleTimeString("nb-NO", { hour: "2-digit", minute: "2-digit" });
  const dager = Math.floor((Date.now() - new Date(d).setHours(0, 0, 0, 0)) / 86_400_000);
  if (dager < 1) return `i dag ${tid}`;
  if (dager < 2) return `i går ${tid}`;
  return d.toLocaleDateString("nb-NO", { day: "numeric", month: "short" });
}

interface RedigerProps {
  startTekst: string;
  startFarge: Lappfarge;
  onLagre: (tekst: string, farge: Lappfarge) => Promise<void>;
  onAvbryt: () => void;
}

/** Selve lappen med tekstfelt og fargevalg. Brukes både for ny lapp og for å endre en gammel. */
function Rediger({ startTekst, startFarge, onLagre, onAvbryt }: RedigerProps) {
  const [tekst, setTekst] = useState(startTekst);
  const [farge, setFarge] = useState(startFarge);
  const [opptatt, setOpptatt] = useState(false);
  const [feil, setFeil] = useState<string | null>(null);

  const lagre = async (e: FormEvent) => {
    e.preventDefault();
    if (!tekst.trim()) return;
    setOpptatt(true);
    setFeil(null);
    try {
      await onLagre(tekst, farge);
    } catch (err) {
      setFeil(err instanceof Error ? err.message : "Noe gikk galt");
      setOpptatt(false);
    }
  };

  return (
    <form className={`lapp lapp-${farge} redigerer`} onSubmit={lagre}>
      <textarea
        value={tekst}
        onChange={(e) => setTekst(e.target.value)}
        maxLength={MAKS_TEKST}
        placeholder="Skriv en lapp …"
        aria-label="Tekst på lappen"
        autoFocus
        required
      />
      <div className="lappfarger" role="radiogroup" aria-label="Farge på lappen">
        {LAPPFARGER.map((f) => (
          <button
            key={f}
            type="button"
            role="radio"
            aria-checked={f === farge}
            aria-label={f}
            className={`prikk lapp-${f}${f === farge ? " valgt" : ""}`}
            onClick={() => setFarge(f)}
          />
        ))}
      </div>
      {feil && (
        <p className="feil" role="alert">
          {feil}
        </p>
      )}
      <div className="lappknapper">
        <small>
          {tekst.length}/{MAKS_TEKST}
        </small>
        <Knapp onClick={onAvbryt} disabled={opptatt}>
          Avbryt
        </Knapp>
        <Knapp type="submit" variant="primær" disabled={opptatt || !tekst.trim()}>
          Fest opp
        </Knapp>
      </div>
    </form>
  );
}

export function Oppslag() {
  const [lapper, setLapper] = useState<Lapp[] | null>(null);
  const [feil, setFeil] = useState<string | null>(null);
  const [skriverNy, setSkriverNy] = useState(false);
  const [redigerer, setRedigerer] = useState<number | null>(null);

  const last = useCallback(async () => {
    try {
      setLapper(await apiGet<Lapp[]>("/api/oppslag"));
      setFeil(null);
    } catch (e) {
      setFeil(e instanceof Error ? e.message : "Noe gikk galt");
    }
  }, []);
  // Holder tavla oppdatert når den står på et nettbrett og andre legger opp lapper
  usePolling(last);

  const opprett = async (tekst: string, farge: Lappfarge) => {
    await apiPost("/api/oppslag", { tekst, farge });
    setSkriverNy(false);
    await last();
  };

  const endre = async (id: number, tekst: string, farge: Lappfarge) => {
    await apiPatch(`/api/oppslag/${id}`, { tekst, farge });
    setRedigerer(null);
    await last();
  };

  const slett = async (lapp: Lapp) => {
    const hvem = lapp.kanEndre && lapp.forfatter.visningsnavn;
    if (!window.confirm(`Ta ned lappen${hvem ? ` fra ${hvem}` : ""}?`)) return;
    try {
      await apiDelete(`/api/oppslag/${lapp.id}`);
      await last();
    } catch (e) {
      setFeil(e instanceof Error ? e.message : "Noe gikk galt");
    }
  };

  return (
    <section className="oppslag">
      <Sidetopp tittel="Oppslagstavla">
        {!skriverNy && (
          <Knapp variant="primær" ikon="legg_til" onClick={() => setSkriverNy(true)}>
            Ny lapp
          </Knapp>
        )}
      </Sidetopp>
      {feil && <Infoboks type="feil">{feil}</Infoboks>}
      <div className="tavle">
        {skriverNy && (
          <Rediger
            startTekst=""
            startFarge="gul"
            onLagre={opprett}
            onAvbryt={() => setSkriverNy(false)}
          />
        )}
        {lapper?.map((l) =>
          redigerer === l.id ? (
            <Rediger
              key={l.id}
              startTekst={l.tekst}
              startFarge={l.farge}
              onLagre={(tekst, farge) => endre(l.id, tekst, farge)}
              onAvbryt={() => setRedigerer(null)}
            />
          ) : (
            <article key={l.id} className={`lapp lapp-${l.farge}`}>
              <p className="lapptekst">{l.tekst}</p>
              <footer>
                <span className="forfatter">
                  <span aria-hidden="true">{l.forfatter.emoji ?? "🙂"}</span>{" "}
                  {l.forfatter.visningsnavn}
                </span>
                <small>
                  {nårSkrevet(l.opprettet)}
                  {l.endret ? " · endret" : ""}
                </small>
              </footer>
              {l.kanEndre && (
                <div className="lappvalg">
                  <button
                    type="button"
                    aria-label="Rediger lappen"
                    title="Rediger"
                    onClick={() => setRedigerer(l.id)}
                  >
                    <Ikon navn="rediger" />
                  </button>
                  <button
                    type="button"
                    aria-label="Ta ned lappen"
                    title="Ta ned"
                    onClick={() => void slett(l)}
                  >
                    <Ikon navn="slett" />
                  </button>
                </div>
              )}
            </article>
          ),
        )}
      </div>
      {lapper?.length === 0 && !skriverNy && (
        <p className="hint tomtavle">Tavla er tom. Trykk «Ny lapp» og fest opp den første.</p>
      )}
    </section>
  );
}
