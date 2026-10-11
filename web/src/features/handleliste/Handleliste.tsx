import { AnimertIkon } from "../../design/AnimertIkon";
import { Sidetopp } from "../../design/Sidetopp";
import { Ikon } from "../../design/Ikon";
import { Infoboks } from "../../design/Infoboks";
import { IkonKnapp, Knapp } from "../../design/Knapp";
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { useAuth } from "../../app/AuthContext";
import { apiDelete, apiGet, apiPatch, apiPost } from "../../lib/api";
import type { Vare } from "../../lib/types";
import { usePolling } from "../../lib/usePolling";

const SOK_VENTETID_MS = 120;

export function Handleliste() {
  const { bruker } = useAuth();
  const forelder = bruker?.rolle === "forelder";
  const [varer, setVarer] = useState<Vare[] | null>(null);
  const [tekst, setTekst] = useState("");
  const [notat, setNotat] = useState("");
  const [redigerer, setRedigerer] = useState<number | null>(null);
  const [nyttNotat, setNyttNotat] = useState("");
  const [forslag, setForslag] = useState<string[]>([]);
  const [fokus, setFokus] = useState(false);
  const [aktivt, setAktivt] = useState(-1);
  const [feil, setFeil] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const felt = useRef<HTMLInputElement>(null);
  const sokNr = useRef(0);
  const listeId = useId();

  const last = useCallback(async () => {
    try {
      setVarer(await apiGet<Vare[]>("/api/handleliste"));
      setFeil(null);
    } catch (e) {
      setFeil(e instanceof Error ? e.message : "Noe gikk galt");
    }
  }, []);
  usePolling(last);

  // Forslag fra varer som er handlet før. Et eldre svar får aldri overstyre et nyere.
  const hentForslag = useCallback(async (q: string) => {
    const nr = ++sokNr.current;
    try {
      const svar = await apiGet<string[]>(`/api/handleliste/forslag?q=${encodeURIComponent(q)}`);
      if (nr === sokNr.current) {
        setForslag(svar);
        setAktivt(-1);
      }
    } catch {
      if (nr === sokNr.current) setForslag([]);
    }
  }, []);

  useEffect(() => {
    if (!fokus) return;
    const timer = setTimeout(() => void hentForslag(tekst), SOK_VENTETID_MS);
    return () => clearTimeout(timer);
  }, [tekst, fokus, hentForslag]);

  const leggTil = async (navn: string) => {
    const rent = navn.trim();
    if (!rent) return;
    setInfo(null);
    try {
      const vare = await apiPost<Vare & { fantesFraFor: boolean }>("/api/handleliste", {
        navn: rent,
        notat: notat.trim() || null,
      });
      if (vare.fantesFraFor) setInfo(`«${vare.navn}» står allerede på lista`);
      setTekst("");
      setNotat("");
      await last();
      await hentForslag("");
      felt.current?.focus();
    } catch (e) {
      setFeil(e instanceof Error ? e.message : "Noe gikk galt");
    }
  };

  const utfør = async (jobb: () => Promise<unknown>) => {
    setInfo(null);
    try {
      await jobb();
    } catch (e) {
      setFeil(e instanceof Error ? e.message : "Noe gikk galt");
    }
    await last();
  };

  const send = (e: FormEvent) => {
    e.preventDefault();
    void leggTil(aktivt >= 0 ? (forslag[aktivt] ?? tekst) : tekst);
  };

  const taster = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown" && forslag.length > 0) {
      e.preventDefault();
      setAktivt((aktivt + 1) % forslag.length);
    } else if (e.key === "ArrowUp" && forslag.length > 0) {
      e.preventDefault();
      setAktivt((aktivt - 1 + forslag.length) % forslag.length);
    } else if (e.key === "Escape") {
      setFokus(false);
      felt.current?.blur();
    }
  };

  const skalHandles = (varer ?? []).filter((v) => !v.kjopt);
  const handlet = (varer ?? []).filter((v) => v.kjopt);
  const visForslag = fokus && forslag.length > 0;

  const linje = (v: Vare) => (
    <li key={v.id} className={v.kjopt ? "vare handlet" : "vare"}>
      <button
        type="button"
        className="varekryss"
        aria-pressed={v.kjopt}
        onClick={() =>
          void utfør(() => apiPost(`/api/handleliste/${v.id}/${v.kjopt ? "angre" : "kjop"}`))
        }
      >
        <span className={v.kjopt ? "rute huket" : "rute"} aria-hidden="true">
          {v.kjopt && <AnimertIkon navn="hake" storrelse="m" spillVedStart={0} />}
        </span>
        <span className="varetekst">
          <span className="varenavn">
            {v.navn}
            {v.mengde && <span className="varemengde"> · {v.mengde}</span>}
          </span>
          {v.notat && <span className="varenotat">{v.notat}</span>}
        </span>
        {v.lagtTilAv && v.lagtTilAv.id !== bruker?.id && (
          <span
            className="vareav"
            title={`Lagt til av ${v.lagtTilAv.visningsnavn}`}
            aria-hidden="true"
          >
            {v.lagtTilAv.emoji ?? "🙂"}
          </span>
        )}
      </button>
      {!v.kjopt && (
        <IkonKnapp
          ikon="notat"
          tittel={`Notat for ${v.navn}`}
          variant="tekst"
          onClick={() => {
            setRedigerer(redigerer === v.id ? null : v.id);
            setNyttNotat(v.egetNotat ?? "");
          }}
        />
      )}
      {forelder && (
        <IkonKnapp
          ikon="slett"
          tittel={`Fjern ${v.navn}`}
          variant="tekst"
          onClick={() => void utfør(() => apiDelete(`/api/handleliste/${v.id}`))}
        />
      )}
      {redigerer === v.id && (
        <form
          className="notatskjema"
          onSubmit={(e) => {
            e.preventDefault();
            void utfør(async () => {
              await apiPatch(`/api/handleliste/${v.id}`, { notat: nyttNotat.trim() || null });
              setRedigerer(null);
            });
          }}
        >
          <input
            value={nyttNotat}
            onChange={(e) => setNyttNotat(e.target.value)}
            maxLength={200}
            placeholder="Notat, f.eks. 2 liter eller helst fra Rema"
            aria-label={`Notat for ${v.navn}`}
            autoFocus
          />
          <Knapp onClick={() => setRedigerer(null)}>Avbryt</Knapp>
          <Knapp type="submit" variant="primær">
            Lagre
          </Knapp>
        </form>
      )}
    </li>
  );

  return (
    <section className="handleliste">
      <Sidetopp tittel="Handleliste" />
      <form className="varefelt" onSubmit={send} role="search">
        <div className="komboboks">
          <input
            ref={felt}
            value={tekst}
            onChange={(e) => setTekst(e.target.value)}
            onFocus={() => setFokus(true)}
            onBlur={() => setTimeout(() => setFokus(false), 150)}
            onKeyDown={taster}
            maxLength={60}
            placeholder="Hva skal handles?"
            autoComplete="off"
            autoCapitalize="sentences"
            enterKeyHint="done"
            role="combobox"
            aria-expanded={visForslag}
            aria-controls={listeId}
            aria-autocomplete="list"
            aria-activedescendant={aktivt >= 0 ? `${listeId}-${aktivt}` : undefined}
            aria-label="Ny vare"
          />
          {visForslag && (
            <ul
              className="forslag"
              id={listeId}
              role="listbox"
              aria-label="Varer du har handlet før"
            >
              {forslag.map((f, i) => (
                <li key={f} id={`${listeId}-${i}`} role="option" aria-selected={i === aktivt}>
                  <button
                    type="button"
                    className={i === aktivt ? "aktiv" : ""}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => void leggTil(f)}
                  >
                    <Ikon navn="historikk" storrelse="s" /> {f}
                  </button>
                </li>
              ))}
            </ul>
          )}
          <input
            className="nyttnotat"
            value={notat}
            onChange={(e) => setNotat(e.target.value)}
            maxLength={200}
            placeholder="Notat (valgfritt)"
            aria-label="Notat til varen"
            autoComplete="off"
          />
        </div>
        <Knapp type="submit" variant="primær" ikon="legg_til" disabled={!tekst.trim()}>
          Legg til
        </Knapp>
      </form>

      {info && <Infoboks type="info">{info}</Infoboks>}
      {feil && <Infoboks type="feil">{feil}</Infoboks>}

      {varer && skalHandles.length === 0 && handlet.length === 0 && (
        <div className="tomliste">
          <AnimertIkon navn="handle" storrelse="xl" spillVedStart={200} />
          <p>Lista er tom. Skriv inn det som skal handles.</p>
        </div>
      )}
      {skalHandles.length > 0 && <ul className="vareliste">{skalHandles.map(linje)}</ul>}

      {handlet.length > 0 && (
        <section className="handletseksjon">
          <div className="handlettopp">
            <h3>Handlet</h3>
            {forelder && (
              <Knapp
                ikon="slett"
                onClick={() => void utfør(() => apiPost("/api/handleliste/fjern-handlede"))}
              >
                Fjern handlede ({handlet.length})
              </Knapp>
            )}
          </div>
          <ul className="vareliste">{handlet.map(linje)}</ul>
        </section>
      )}
    </section>
  );
}
