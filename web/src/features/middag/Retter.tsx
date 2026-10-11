import { Tekstfelt, Tekstomrade } from "../../design/Felt";
import { Infoboks } from "../../design/Infoboks";
import { IkonKnapp, Knapp } from "../../design/Knapp";
import { useCallback, useState, type FormEvent } from "react";
import { apiDelete, apiGet, apiPost, apiPut } from "../../lib/api";
import type { Rett } from "../../lib/types";
import { usePolling } from "../../lib/usePolling";
import { KiRetter } from "./KiRetter";
import { Snitt } from "./Stjerner";

interface SkjemaProps {
  rett: Rett | null;
  onLagre: (data: {
    tittel: string;
    notat: string | null;
    ingredienser: string[];
  }) => Promise<void>;
  onAvbryt: () => void;
}

function RettSkjema({ rett, onLagre, onAvbryt }: SkjemaProps) {
  const [tittel, setTittel] = useState(rett?.tittel ?? "");
  const [notat, setNotat] = useState(rett?.notat ?? "");
  const [ingredienser, setIngredienser] = useState((rett?.ingredienser ?? []).join("\n"));
  const [opptatt, setOpptatt] = useState(false);
  const [feil, setFeil] = useState<string | null>(null);

  const lagre = async (e: FormEvent) => {
    e.preventDefault();
    setOpptatt(true);
    setFeil(null);
    try {
      await onLagre({
        tittel: tittel.trim(),
        notat: notat.trim() || null,
        ingredienser: ingredienser
          .split("\n")
          .map((i) => i.trim())
          .filter(Boolean),
      });
    } catch (err) {
      setFeil(err instanceof Error ? err.message : "Noe gikk galt");
      setOpptatt(false);
    }
  };

  return (
    <form className="nyttskjema rettskjema" onSubmit={lagre}>
      <h3>{rett ? "Endre rett" : "Ny rett"}</h3>
      <Tekstfelt
        etikett="Tittel"
        value={tittel}
        onChange={(e) => setTittel(e.target.value)}
        maxLength={80}
        placeholder="F.eks. Tacofredag"
        autoFocus
        required
      />
      <Tekstomrade
        etikett="Notat (valgfritt)"
        value={notat}
        onChange={(e) => setNotat(e.target.value)}
        maxLength={1000}
        rows={2}
        placeholder="F.eks. Husk å ta ut fisken av fryseren"
      />
      <Tekstomrade
        etikett="Ingredienser (én per linje)"
        value={ingredienser}
        onChange={(e) => setIngredienser(e.target.value)}
        rows={6}
        placeholder={"1 pk tortilla\n400 g kjøttdeig\n1 stk salat"}
      />
      <p className="hint">
        Skriv gjerne mengde først, for eksempel «400 g kjøttdeig» eller «2 dl fløte». Når flere
        middager trenger samme vare, legges mengdene sammen på handlelisten. Ingrediensene legges på
        handlelisten når du setter retten på en dag.
      </p>
      {feil && <Infoboks type="feil">{feil}</Infoboks>}
      <div className="handlinger">
        <Knapp onClick={onAvbryt} disabled={opptatt}>
          Avbryt
        </Knapp>
        <Knapp type="submit" variant="primær" disabled={opptatt || !tittel.trim()}>
          Lagre
        </Knapp>
      </div>
    </form>
  );
}

/** Voksnes sted for faste middagsretter. Best score først. */
export function Retter() {
  const [retter, setRetter] = useState<Rett[] | null>(null);
  const [skjema, setSkjema] = useState<{ rett: Rett | null } | null>(null);
  const [feil, setFeil] = useState<string | null>(null);

  const last = useCallback(async () => {
    try {
      setRetter(await apiGet<Rett[]>("/api/middag/retter"));
      setFeil(null);
    } catch (e) {
      setFeil(e instanceof Error ? e.message : "Noe gikk galt");
    }
  }, []);
  usePolling(last);

  const lagre = async (data: { tittel: string; notat: string | null; ingredienser: string[] }) => {
    if (skjema?.rett) await apiPut(`/api/middag/retter/${skjema.rett.id}`, data);
    else await apiPost("/api/middag/retter", data);
    setSkjema(null);
    await last();
  };

  const slett = (r: Rett) => {
    if (!window.confirm(`Slette «${r.tittel}»? Dager som er planlagt med den beholder navnet.`))
      return;
    apiDelete(`/api/middag/retter/${r.id}`)
      .then(last)
      .catch((e: Error) => setFeil(e.message));
  };

  return (
    <section className="retter">
      {!skjema && (
        <div className="sideverktoy">
          <Knapp variant="primær" ikon="legg_til" onClick={() => setSkjema({ rett: null })}>
            Ny rett
          </Knapp>
          <KiRetter onInnlagt={last} />
        </div>
      )}
      {feil && <Infoboks type="feil">{feil}</Infoboks>}
      {skjema && (
        <RettSkjema
          key={skjema.rett?.id ?? "ny"}
          rett={skjema.rett}
          onLagre={lagre}
          onAvbryt={() => setSkjema(null)}
        />
      )}
      {retter && retter.length === 0 && !skjema && (
        <p className="hint tomtavle">
          Ingen retter ennå. Trykk «Ny rett», eller la KI-en lage noen.
        </p>
      )}
      <ul className="rettliste">
        {retter?.map((r) => (
          <li key={r.id} className="rett-kort">
            <div className="rett-topp">
              <strong className="retttittel">{r.tittel}</strong>
              <span className="handlinger">
                <IkonKnapp
                  ikon="rediger"
                  tittel={`Endre ${r.tittel}`}
                  variant="tekst"
                  onClick={() => setSkjema({ rett: r })}
                />
                <IkonKnapp
                  ikon="slett"
                  tittel={`Slett ${r.tittel}`}
                  variant="tekst"
                  onClick={() => slett(r)}
                />
              </span>
            </div>
            <Snitt snitt={r.snitt} antall={r.antall} />
            {r.notat && <span className="hendelsetid rettnotat">{r.notat}</span>}
            <span className="hendelsetid">
              {r.ingredienser && r.ingredienser.length > 0
                ? `Ingredienser: ${r.ingredienser.join(", ")}`
                : "Ingen ingredienser"}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
