import { Ikon } from "../../design/Ikon";
import { Navlinje, Sidetopp } from "../../design/Sidetopp";
import { Infoboks } from "../../design/Infoboks";
import { Knapp } from "../../design/Knapp";
import { useCallback, useMemo, useState } from "react";
import { useAuth } from "../../app/AuthContext";
import { apiDelete, apiGet, apiPut } from "../../lib/api";
import {
  iDag,
  kortDato,
  kortUkedag,
  leggTilDager,
  mandagFor,
  maanedOgAar,
  ukenr,
} from "../../lib/dato";
import type { Middag as MiddagType, Rett } from "../../lib/types";
import { usePolling } from "../../lib/usePolling";
import { IngrediensBoks } from "./IngrediensBoks";
import { KiMiddag } from "./KiMiddag";
import { Retter } from "./Retter";
import { RetterListe } from "./RetterListe";
import { formaterSnitt } from "./Stjerner";

/** Ukeplanen. Man skriver ingenting her, men velger fra listen med retter. */
function Ukeplan({ gaTilRetter }: { gaTilRetter: () => void }) {
  const dagensDato = iDag();
  const [mandag, setMandag] = useState(mandagFor(dagensDato));
  const [middager, setMiddager] = useState<MiddagType[]>([]);
  const [retter, setRetter] = useState<Rett[]>([]);
  const [melding, setMelding] = useState<{ dato: string; tekst: string } | null>(null);
  const [feil, setFeil] = useState<string | null>(null);
  /** Rett og dag som venter på at man velger hvilke ingredienser som skal på handlelisten. */
  const [avventer, setAvventer] = useState<{ dato: string; rett: Rett } | null>(null);

  const dager = useMemo(
    () => Array.from({ length: 7 }, (_, i) => leggTilDager(mandag, i)),
    [mandag],
  );
  const til = leggTilDager(mandag, 7);

  const last = useCallback(async () => {
    try {
      const [m, r] = await Promise.all([
        apiGet<MiddagType[]>(`/api/middag?fra=${mandag}&til=${til}`),
        apiGet<Rett[]>("/api/middag/retter"),
      ]);
      setMiddager(m);
      setRetter(r);
      setFeil(null);
    } catch (e) {
      setFeil(e instanceof Error ? e.message : "Noe gikk galt");
    }
  }, [mandag, til]);
  usePolling(last);

  const perDato = new Map(middager.map((m) => [m.dato, m]));

  const settRett = async (dato: string, rett: Rett, valgte?: string[]) => {
    await apiPut(`/api/middag/${dato}`, { rettId: rett.id, ingredienser: valgte });
    const alle = rett.ingredienser?.length ?? 0;
    const paaLista = valgte?.length ?? alle;
    let tekst = `${rett.tittel} er valgt.`;
    if (alle > 0) {
      tekst +=
        paaLista === 0
          ? " Ingenting er lagt på handlelisten."
          : paaLista === alle
            ? ` ${paaLista} ${paaLista === 1 ? "ingrediens er" : "ingredienser er"} lagt på handlelisten.`
            : ` ${paaLista} av ${alle} ingredienser er lagt på handlelisten.`;
    }
    setMelding({ dato, tekst });
  };

  const velg = async (dato: string, verdi: string) => {
    setMelding(null);
    try {
      if (verdi === "") {
        await apiDelete(`/api/middag/${dato}`);
        setMelding({
          dato,
          tekst:
            "Middagen er fjernet, og ingrediensene som var lagt til for den er tatt av handlelisten.",
        });
      } else {
        const rett = retter.find((r) => r.id === Number(verdi));
        if (!rett) return;
        // Har retten ingredienser, spør vi først hva som skal på handlelisten
        if ((rett.ingredienser?.length ?? 0) > 0) {
          setAvventer({ dato, rett });
          return;
        }
        await settRett(dato, rett);
      }
    } catch (e) {
      setFeil(e instanceof Error ? e.message : "Noe gikk galt");
    }
    await last();
  };

  return (
    <>
      <Navlinje
        tekst={`Uke ${ukenr(mandag)} · ${maanedOgAar(mandag).toLocaleLowerCase("nb-NO")}`}
        forrige={() => setMandag(leggTilDager(mandag, -7))}
        neste={() => setMandag(leggTilDager(mandag, 7))}
        iDag={() => setMandag(mandagFor(dagensDato))}
        enhet="uke"
      />

      {feil && <Infoboks type="feil">{feil}</Infoboks>}
      {retter.length > 0 && (
        <div className="sideverktoy">
          <KiMiddag retter={retter} onInnlagt={last} />
        </div>
      )}
      {retter.length === 0 && (
        <p className="hint tomtavle">
          Du har ingen retter ennå.{" "}
          <Knapp variant="tekst" className="lenke" onClick={gaTilRetter}>
            Lag den første under «Retter»
          </Knapp>
        </p>
      )}

      <ul className="middagsuke">
        {dager.map((d) => {
          const m = perDato.get(d);
          const erIDag = d === dagensDato;
          return (
            <li key={d} className={erIDag ? "middagsdag idag" : "middagsdag"}>
              <div className="middagsdato">
                <strong>{kortUkedag(d)}</strong>
                <span>{kortDato(d)}</span>
                {erIDag && <small>i dag</small>}
              </div>
              <div className="middagsvalg">
                <select
                  value={m?.rettId ?? ""}
                  onChange={(e) => void velg(d, e.target.value)}
                  aria-label={`Middag ${kortUkedag(d)} ${kortDato(d)}`}
                >
                  <option value="">{m ? "Ingen middag" : "Velg middag …"}</option>
                  {retter.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.tittel}
                      {/* En nedtrekksliste kan ikke vise ikoner, så her brukes stjernetegnet */}
                      {r.snitt !== null ? ` (★ ${formaterSnitt(r.snitt)})` : ""}
                    </option>
                  ))}
                </select>
                {m && m.rettId === null && (
                  <span className="hendelsetid">{m.rett} (retten er slettet)</span>
                )}
                {m?.notat && <span className="notat">{m.notat}</span>}
                {melding?.dato === d && <Infoboks type="ok">{melding.tekst}</Infoboks>}
              </div>
            </li>
          );
        })}
      </ul>

      {avventer && (
        <IngrediensBoks
          rett={avventer.rett}
          dato={avventer.dato}
          onAvbryt={() => setAvventer(null)}
          onBekreft={async (valgte) => {
            setMelding(null);
            await settRett(avventer.dato, avventer.rett, valgte);
            setAvventer(null);
            await last();
          }}
        />
      )}
    </>
  );
}

type Visning = "uke" | "retter";

export function Middag() {
  const { bruker } = useAuth();
  const [visning, setVisning] = useState<Visning>("uke");

  // Barn får bare listen med retter og scoren sin.
  if (bruker?.rolle !== "forelder") return <RetterListe />;

  return (
    <section className="middag">
      <Sidetopp tittel="Middag">
        <div className="bryter" role="group" aria-label="Visning">
          <button
            type="button"
            className={visning === "uke" ? "aktiv" : ""}
            aria-pressed={visning === "uke"}
            onClick={() => setVisning("uke")}
          >
            <Ikon navn="kalender" storrelse="s" /> Ukeplan
          </button>
          <button
            type="button"
            className={visning === "retter" ? "aktiv" : ""}
            aria-pressed={visning === "retter"}
            onClick={() => setVisning("retter")}
          >
            <Ikon navn="middag" storrelse="s" /> Retter
          </button>
        </div>
      </Sidetopp>
      {visning === "uke" ? <Ukeplan gaTilRetter={() => setVisning("retter")} /> : <Retter />}
    </section>
  );
}
