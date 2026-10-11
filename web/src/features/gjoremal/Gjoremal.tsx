import { Ikon } from "../../design/Ikon";
import { Sidetopp } from "../../design/Sidetopp";
import type { Ikonnavn } from "../../design/ikoner";
import { Infoboks } from "../../design/Infoboks";
import { IkonKnapp, Knapp } from "../../design/Knapp";
import { Merke } from "../../design/Merke";
import { Tekstfelt, Valgfelt } from "../../design/Felt";
import { lesbarTekstfarge } from "../../lib/farge";
import { useCallback, useState, type FormEvent } from "react";
import { useAuth } from "../../app/AuthContext";
import { apiDelete, apiGet, apiPatch, apiPost } from "../../lib/api";
import { iDag, kortDato } from "../../lib/dato";
import type { Bruker, Gjentakelse, Oppgave, Poengstatus } from "../../lib/types";
import { usePolling } from "../../lib/usePolling";
import { PoengKort } from "./Poeng";

const MAKS_POENG = 1000;
/** Mest en besteforelder kan gi i poeng. Serveren sjekker det samme. */
const MAKS_POENG_BESTEFORELDER = 30;

const GJENTAKELSER: { verdi: Gjentakelse; tekst: string; merke: string }[] = [
  { verdi: "daglig", tekst: "Hver dag", merke: "Hver dag" },
  { verdi: "ukentlig", tekst: "Hver uke", merke: "Hver uke" },
  { verdi: "annenhver_uke", tekst: "Annenhver uke", merke: "Annenhver uke" },
  { verdi: "maanedlig", tekst: "Hver måned", merke: "Hver måned" },
];

/** Et gjentakende gjøremål som er godkjent og venter på neste runde. Bare voksne ser dem. */
const hviler = (o: Oppgave) => o.status === "ledig" && !!o.ledigFra && o.ledigFra > iDag();

const gjentakelseTekst = (g: Gjentakelse) => GJENTAKELSER.find((x) => x.verdi === g)!.merke;

interface SkjemaProps {
  startTittel: string;
  startPoeng: number;
  startGjentas: Gjentakelse | null;
  maksPoeng: number;
  knapp: string;
  onLagre: (tittel: string, poeng: number, gjentas: Gjentakelse | null) => Promise<void>;
  onAvbryt: () => void;
}

/** Skjema for å lage eller endre et gjøremål (voksne). Besteforeldre kan gi høyst 30 poeng. */
function Skjema({
  startTittel,
  startPoeng,
  startGjentas,
  maksPoeng,
  knapp,
  onLagre,
  onAvbryt,
}: SkjemaProps) {
  const [tittel, setTittel] = useState(startTittel);
  const [poeng, setPoeng] = useState(String(startPoeng));
  const [gjentas, setGjentas] = useState<Gjentakelse | "">(startGjentas ?? "");
  const [opptatt, setOpptatt] = useState(false);

  const lagre = async (e: FormEvent) => {
    e.preventDefault();
    if (!tittel.trim()) return;
    setOpptatt(true);
    try {
      await onLagre(tittel.trim(), Number(poeng || 0), gjentas || null);
    } finally {
      setOpptatt(false);
    }
  };

  return (
    <form className="oppgave skjema" onSubmit={lagre}>
      <Tekstfelt
        etikett="Hva skal gjøres?"
        value={tittel}
        onChange={(e) => setTittel(e.target.value)}
        maxLength={80}
        placeholder="F.eks. Tømme oppvaskmaskinen"
        autoFocus
        required
      />
      <Tekstfelt
        etikett="Poeng"
        inputMode="numeric"
        pattern="[0-9]*"
        maxLength={4}
        value={poeng}
        onChange={(e) => {
          const rent = e.target.value.replace(/\D/g, "");
          setPoeng(Number(rent) > maksPoeng ? String(maksPoeng) : rent);
        }}
      />
      <Valgfelt
        etikett="Kommer tilbake"
        hjelp="Etter at det er godkjent, kan det gjøres på nytt neste dag, neste uke, om to uker eller neste måned."
        value={gjentas}
        onChange={(e) => setGjentas(e.target.value as Gjentakelse | "")}
      >
        <option value="">Nei, bare én gang</option>
        {GJENTAKELSER.map((g) => (
          <option key={g.verdi} value={g.verdi}>
            {g.tekst}
          </option>
        ))}
      </Valgfelt>
      <div className="oppgaveknapper">
        <Knapp onClick={onAvbryt} disabled={opptatt}>
          Avbryt
        </Knapp>
        <Knapp type="submit" variant="primær" disabled={opptatt || !tittel.trim()}>
          {knapp}
        </Knapp>
      </div>
    </form>
  );
}

interface KortProps {
  o: Oppgave;
  bruker: Bruker;
  handling: (id: number, hva: string) => void;
  onRediger: (id: number) => void;
  onSlett: (o: Oppgave) => void;
}

function Eier({ o }: { o: Oppgave }) {
  if (!o.eier) return null;
  return (
    <span
      className="eier"
      style={{ background: o.eier.farge, color: lesbarTekstfarge(o.eier.farge) }}
    >
      {o.eier.emoji ?? "🙂"} {o.eier.visningsnavn}
    </span>
  );
}

function Kort({ o, bruker, handling, onRediger, onSlett }: KortProps) {
  const forelder = bruker.rolle === "forelder";
  const barn = bruker.rolle === "barn";
  // Foreldre styrer alle gjøremål, og besteforeldre de de selv har laget
  const kanStyre = forelder || (bruker.rolle === "besteforelder" && o.opprettetAv === bruker.id);
  const min = o.eier?.id === bruker.id;
  return (
    <article className={`oppgave ${o.status}`}>
      <div className="oppgavetopp">
        <h3>{o.tittel}</h3>
        <span className="oppgavemerker">
          {o.gjentas && (
            <Merke tone="noytral" ikon="gjenta">
              {gjentakelseTekst(o.gjentas)}
            </Merke>
          )}
          <Merke tone="sand" ikon="stjerne" ikonFylt>
            {o.poeng}
          </Merke>
        </span>
      </div>
      {hviler(o) && o.ledigFra && (
        <p className="oppgaveinfo">Kan tas igjen {kortDato(o.ledigFra)}</p>
      )}
      {o.eier && (
        <p className="oppgaveinfo">
          <Eier o={o} />
          {o.status === "venter" && <span> meldte det ferdig</span>}
          {o.status === "godkjent" && (
            <span className="godkjent-tekst">
              <Ikon navn="hake" storrelse="s" /> godkjent
            </span>
          )}
        </p>
      )}
      <div className="oppgaveknapper">
        {barn && o.status === "ledig" && (
          <Knapp variant="primær" storrelse="stor" ikon="hand" onClick={() => handling(o.id, "ta")}>
            Jeg tar den
          </Knapp>
        )}
        {barn && o.status === "tatt" && min && (
          <>
            <Knapp onClick={() => handling(o.id, "slipp")}>Slipp</Knapp>
            <Knapp
              variant="primær"
              storrelse="stor"
              ikon="hake"
              onClick={() => handling(o.id, "fullfor")}
            >
              Ferdig
            </Knapp>
          </>
        )}
        {barn && o.status === "venter" && min && (
          <>
            <span className="venter">
              <Ikon navn="klokke" storrelse="s" /> Venter på godkjenning
            </span>
            <Knapp onClick={() => handling(o.id, "angre")}>Angre</Knapp>
          </>
        )}
        {kanStyre && o.status === "venter" && (
          <>
            <Knapp onClick={() => handling(o.id, "avvis")}>Ikke ferdig ennå</Knapp>
            <Knapp
              variant="primær"
              storrelse="stor"
              ikon="tommel"
              onClick={() => handling(o.id, "godkjenn")}
            >
              Godkjenn +{o.poeng}
            </Knapp>
          </>
        )}
        {forelder && o.status === "tatt" && (
          <Knapp onClick={() => handling(o.id, "slipp")}>Frigjør</Knapp>
        )}
        {kanStyre && (
          <span className="verktoy">
            {o.status !== "godkjent" && (
              <IkonKnapp
                ikon="rediger"
                tittel="Endre gjøremålet"
                variant="tekst"
                onClick={() => onRediger(o.id)}
              />
            )}
            <IkonKnapp
              ikon="slett"
              tittel="Slett gjøremålet"
              variant="tekst"
              onClick={() => onSlett(o)}
            />
          </span>
        )}
      </div>
    </article>
  );
}

/**
 * Godkjente gjøremål som en tett liste, så de ikke ligner på de som er ledige eller tatt: én linje per
 * gjøremål, uten kort og uten knapper bortsett fra å slette (for dem som styrer gjøremålet).
 */
export function FerdigListe({
  oppgaver,
  kanStyre,
  onSlett,
}: {
  oppgaver: Oppgave[];
  kanStyre: (o: Oppgave) => boolean;
  onSlett: (o: Oppgave) => void;
}) {
  if (oppgaver.length === 0) return null;
  return (
    <section className="seksjon ferdige">
      <h3 className="seksjonstittel ferdige__tittel">Nylig godkjent</h3>
      <ul className="ferdigliste">
        {oppgaver.map((o) => (
          <li key={o.id} className="ferdigrad">
            <Ikon navn="hake" storrelse="s" />
            <span className="ferdigrad__tekst">
              <span className="ferdigrad__tittel">{o.tittel}</span>
              <span className="ferdigrad__meta">
                {o.eier ? `${o.eier.emoji ?? "🙂"} ${o.eier.visningsnavn} · ` : ""}+{o.poeng}
              </span>
            </span>
            {kanStyre(o) && (
              <IkonKnapp
                ikon="slett"
                tittel={`Slett ${o.tittel}`}
                variant="tekst"
                onClick={() => onSlett(o)}
              />
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

function Seksjon({
  tittel,
  ikon,
  antall,
  children,
}: {
  tittel: string;
  ikon?: Ikonnavn;
  antall: number;
  children: React.ReactNode;
}) {
  if (antall === 0) return null;
  return (
    <section className="seksjon">
      <h3 className="seksjonstittel">
        {ikon && <Ikon navn={ikon} storrelse="m" />}
        {tittel}
      </h3>
      <div className="oppgaver">{children}</div>
    </section>
  );
}

export function Gjoremal() {
  const { bruker } = useAuth();
  const [oppgaver, setOppgaver] = useState<Oppgave[] | null>(null);
  const [poeng, setPoeng] = useState<Poengstatus[]>([]);
  const [feil, setFeil] = useState<string | null>(null);
  const [visNy, setVisNy] = useState(false);
  const [redigerer, setRedigerer] = useState<number | null>(null);

  const last = useCallback(async () => {
    try {
      const [o, p] = await Promise.all([
        apiGet<Oppgave[]>("/api/gjoremal"),
        apiGet<Poengstatus[]>("/api/gjoremal/poeng"),
      ]);
      setOppgaver(o);
      setPoeng(p);
      setFeil(null);
    } catch (e) {
      setFeil(e instanceof Error ? e.message : "Noe gikk galt");
    }
  }, []);
  usePolling(last);

  // Etter en feil (f.eks. at noen andre tok gjøremålet først) vises den nyeste tilstanden og meldingen
  const utfør = async (jobb: () => Promise<unknown>) => {
    try {
      await jobb();
      await last();
    } catch (e) {
      await last();
      setFeil(e instanceof Error ? e.message : "Noe gikk galt");
    }
  };

  if (!bruker) return null;
  const forelder = bruker.rolle === "forelder";
  const barn = bruker.rolle === "barn";
  const voksen = !barn;
  const maksPoeng = forelder ? MAKS_POENG : MAKS_POENG_BESTEFORELDER;
  const kanStyre = (o: Oppgave) => forelder || o.opprettetAv === bruker.id;

  const handling = (id: number, hva: string) =>
    void utfør(() => apiPost(`/api/gjoremal/${id}/${hva}`));
  const slett = (o: Oppgave) => {
    const ekstra = o.status === "godkjent" ? " Poengene som er gitt blir stående." : "";
    if (!window.confirm(`Slette «${o.tittel}»?${ekstra}`)) return;
    void utfør(() => apiDelete(`/api/gjoremal/${o.id}`));
  };

  const alle = oppgaver ?? [];
  const venter = alle.filter((o) => o.status === "venter" && kanStyre(o));
  const ledige = alle.filter((o) => o.status === "ledig" && !hviler(o));
  const kommerIgjen = alle.filter(hviler);
  const mine = alle.filter(
    (o) => o.eier?.id === bruker.id && (o.status === "tatt" || o.status === "venter"),
  );
  const tatt = alle.filter((o) =>
    voksen
      ? o.status === "tatt" || (o.status === "venter" && !kanStyre(o))
      : (o.status === "tatt" || o.status === "venter") && o.eier?.id !== bruker.id,
  );
  const godkjent = alle.filter((o) => o.status === "godkjent");

  const kort = (o: Oppgave) =>
    redigerer === o.id ? (
      <Skjema
        key={o.id}
        startTittel={o.tittel}
        startPoeng={o.poeng}
        startGjentas={o.gjentas}
        maksPoeng={maksPoeng}
        knapp="Lagre"
        onLagre={(tittel, p, gjentas) =>
          utfør(async () => {
            await apiPatch(`/api/gjoremal/${o.id}`, { tittel, poeng: p, gjentas });
            setRedigerer(null);
          })
        }
        onAvbryt={() => setRedigerer(null)}
      />
    ) : (
      <Kort
        key={o.id}
        o={o}
        bruker={bruker}
        handling={handling}
        onRediger={setRedigerer}
        onSlett={slett}
      />
    );

  return (
    <section className="gjoremal">
      <Sidetopp tittel="Gjøremål">
        {voksen && !visNy && (
          <Knapp variant="primær" ikon="legg_til" onClick={() => setVisNy(true)}>
            Nytt gjøremål
          </Knapp>
        )}
      </Sidetopp>

      {poeng.length > 0 && (
        <div className="poengrad">
          {poeng.map((p) => (
            <PoengKort key={p.bruker.id} status={p} navn={voksen} />
          ))}
        </div>
      )}

      {feil && <Infoboks type="feil">{feil}</Infoboks>}

      {voksen && visNy && (
        <div className="oppgaver">
          <Skjema
            startTittel=""
            startPoeng={10}
            startGjentas={null}
            maksPoeng={maksPoeng}
            knapp="Legg til"
            onLagre={(tittel, p, gjentas) =>
              utfør(async () => {
                await apiPost("/api/gjoremal", { tittel, poeng: p, gjentas });
                setVisNy(false);
              })
            }
            onAvbryt={() => setVisNy(false)}
          />
        </div>
      )}

      {voksen && (
        <Seksjon tittel="Venter på godkjenning" ikon="tommel" antall={venter.length}>
          {venter.map(kort)}
        </Seksjon>
      )}
      {barn && (
        <Seksjon tittel="Mine gjøremål" antall={mine.length}>
          {mine.map(kort)}
        </Seksjon>
      )}
      <Seksjon tittel="Ledige gjøremål" antall={ledige.length}>
        {ledige.map(kort)}
      </Seksjon>
      <Seksjon tittel={voksen ? "Tatt, ikke ferdig" : "Tatt av andre"} antall={tatt.length}>
        {tatt.map(kort)}
      </Seksjon>
      {voksen && (
        <Seksjon tittel="Kommer igjen" ikon="gjenta" antall={kommerIgjen.length}>
          {kommerIgjen.map(kort)}
        </Seksjon>
      )}
      <FerdigListe oppgaver={godkjent} kanStyre={kanStyre} onSlett={slett} />

      {oppgaver && alle.length === 0 && !visNy && (
        <p className="hint tomtavle">
          {voksen
            ? "Ingen gjøremål ennå. Trykk «Nytt gjøremål» for å legge inn det første."
            : "Det er ingen gjøremål akkurat nå."}
        </p>
      )}
    </section>
  );
}
