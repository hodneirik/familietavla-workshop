import { AnimertIkon, type IkonSpill } from "../../design/AnimertIkon";
import { Ikon } from "../../design/Ikon";
import { Infoboks } from "../../design/Infoboks";
import { IkonKnapp } from "../../design/Knapp";
import { useCallback, useRef, useState } from "react";
import { apiGet } from "../../lib/api";
import { kortDato } from "../../lib/dato";
import type { Hendelse, Kalender, Middag } from "../../lib/types";
import { usePolling } from "../../lib/usePolling";
import { StjerneRekke, StjerneVelger } from "../middag/Stjerner";
import { tidTekst } from "./tid";

/** Henter kalendere, avtaler og middager for et tidsrom (til er ikke med), og holder dem oppdatert. */
export function useDagsplan(fra: string, til: string) {
  const [kalendere, setKalendere] = useState<Kalender[]>([]);
  const [hendelser, setHendelser] = useState<Hendelse[]>([]);
  const [middager, setMiddager] = useState<Middag[]>([]);
  const [feil, setFeil] = useState<string | null>(null);

  const last = useCallback(async () => {
    try {
      const [k, h, m] = await Promise.all([
        apiGet<Kalender[]>("/api/kalender/kalendere"),
        apiGet<Hendelse[]>(`/api/kalender/hendelser?fra=${fra}&til=${til}`),
        apiGet<Middag[]>(`/api/middag?fra=${fra}&til=${til}`),
      ]);
      setKalendere(k);
      setHendelser(h);
      setMiddager(m);
      setFeil(null);
    } catch (e) {
      setFeil(e instanceof Error ? e.message : "Noe gikk galt");
    }
  }, [fra, til]);
  usePolling(last);

  return { kalendere, hendelser, middager, feil, setFeil, last };
}

interface RadProps {
  h: Hendelse;
  kalender: Kalender | undefined;
  kanEndre: boolean;
  onRediger?: (h: Hendelse) => void;
  onSlett?: (h: Hendelse) => void;
}

export function HendelseRad({ h, kalender, kanEndre, onRediger, onSlett }: RadProps) {
  return (
    <li className="hendelse" style={{ borderLeftColor: kalender?.farge ?? "var(--accent)" }}>
      <div className="hendelsetekst">
        <strong>{h.tittel}</strong>
        <span className="hendelsetid">{tidTekst(h)}</span>
        {h.gjentas && h.gjentasTil && (
          <span className="hendelsested">
            <Ikon navn="gjenta" storrelse="xs" /> Hver uke til og med {kortDato(h.gjentasTil)}
          </span>
        )}
        {h.sted && (
          <span className="hendelsested">
            <Ikon navn="sted" storrelse="xs" /> {h.sted}
          </span>
        )}
        <small>{kalender?.navn}</small>
      </div>
      {kanEndre && h.kilde === "manuell" && onRediger && onSlett && (
        <span className="handlinger">
          <IkonKnapp
            ikon="rediger"
            tittel={`Endre ${h.tittel}`}
            variant="tekst"
            onClick={() => onRediger(h)}
          />
          <IkonKnapp
            ikon="slett"
            tittel={`Slett ${h.tittel}`}
            variant="tekst"
            onClick={() => onSlett(h)}
          />
        </span>
      )}
    </li>
  );
}

/**
 * Middagen for dagen, vist sammen med avtalene slik at alle ser hva det er til middag.
 * Gis `onStjerner`, kan man trykke på middagen og gi den 1 til 5 stjerner (bare for dagens middag).
 */
export function MiddagRad({
  m,
  onStjerner,
}: {
  m: Middag;
  onStjerner?: (stjerner: number) => Promise<void>;
}) {
  const [apen, setApen] = useState(false);
  const [feil, setFeil] = useState<string | null>(null);
  const suppe = useRef<IkonSpill>(null);

  const innhold = (
    <div className="hendelsetekst">
      <strong>
        <AnimertIkon ref={suppe} navn="middag" storrelse="m" spillVedStart={300} />
        <span>Middag: {m.rett}</span>
      </strong>
      {m.notat && <span className="hendelsetid">{m.notat}</span>}
      {onStjerner && (
        <span className="hendelsetid">
          {m.minStjerner === null ? (
            "Trykk for å gi stjerner"
          ) : (
            <>
              Din score: <StjerneRekke verdi={m.minStjerner} />
            </>
          )}
        </span>
      )}
    </div>
  );
  if (!onStjerner) return <li className="hendelse middagsrad">{innhold}</li>;

  return (
    <li className="hendelse middagsrad klikkbar">
      <button
        type="button"
        className="middagsklikk"
        aria-expanded={apen}
        onClick={() => {
          suppe.current?.spill();
          setApen(!apen);
        }}
      >
        {innhold}
      </button>
      {apen && (
        <div className="stjerneboks">
          <p>Hvor god var middagen?</p>
          <StjerneVelger
            verdi={m.minStjerner}
            onVelg={(n) => {
              setFeil(null);
              onStjerner(n).catch((e: Error) => setFeil(e.message));
            }}
          />
          {feil && <Infoboks type="feil">{feil}</Infoboks>}
        </div>
      )}
    </li>
  );
}

interface InnholdProps {
  hendelser: Hendelse[];
  middag: Middag | null;
  kalenderMap: Map<number, Kalender>;
  kanEndre: boolean;
  onRediger?: (h: Hendelse) => void;
  onSlett?: (h: Hendelse) => void;
  /** Teksten når dagen er tom. Null betyr at noe annet i kortet fyller dagen, så ingen tekst vises. */
  tomTekst?: string | null;
  /** Gis bare for dagens middag. */
  onStjerner?: (dato: string, stjerner: number) => Promise<void>;
}

/** Middagen først, så avtalene. Brukes i kalenderen og på Hjem. */
export function Dagsinnhold({
  hendelser,
  middag,
  kalenderMap,
  kanEndre,
  onRediger,
  onSlett,
  tomTekst = "Ingen avtaler",
  onStjerner,
}: InnholdProps) {
  if (hendelser.length === 0 && !middag)
    return tomTekst === null ? null : <p className="hint">{tomTekst}</p>;
  return (
    <ul className="hendelser">
      {middag && (
        <MiddagRad
          m={middag}
          onStjerner={onStjerner ? (n) => onStjerner(middag.dato, n) : undefined}
        />
      )}
      {hendelser.map((h) => (
        <HendelseRad
          key={`${h.id}-${h.start}`}
          h={h}
          kalender={kalenderMap.get(h.kalenderId)}
          kanEndre={kanEndre}
          onRediger={onRediger}
          onSlett={onSlett}
        />
      ))}
    </ul>
  );
}
