import { Avkrysning, Tekstfelt, Tekstomrade, Valgfelt } from "../../design/Felt";
import { Knapp } from "../../design/Knapp";
import { Merke } from "../../design/Merke";
import { iDag, leggTilDager } from "../../lib/dato";
import { LAPPFARGER } from "../../lib/types";
import type {
  AvtaleRedigert,
  ForslagHandling,
  ForslagState,
  Gruppe,
  LappRedigert,
  LeksRedigert,
  PaaminnelseRedigert,
} from "./forslagLogikk";

type Send = (h: ForslagHandling) => void;

function Gruppeoverskrift({
  tittel,
  gruppe,
  antall,
  valgt,
  send,
}: {
  tittel: string;
  gruppe: Gruppe;
  antall: number;
  valgt: number;
  send: Send;
}) {
  return (
    <div className="kigruppetopp">
      <h3>
        {tittel} <Merke>{antall}</Merke>
      </h3>
      <Knapp
        variant="tekst"
        onClick={() => send({ type: "velgAlle", gruppe, valgt: valgt < antall })}
      >
        {valgt < antall ? "Velg alle" : "Fjern alle"}
      </Knapp>
    </div>
  );
}

function Lekse({ l, send }: { l: LeksRedigert; send: Send }) {
  const endre = (felt: string, verdi: string) =>
    send({ type: "endre", gruppe: "lekser", forslagId: l.forslagId, felt, verdi });
  return (
    <li className={l.valgt ? "kiforslag" : "kiforslag av"}>
      <Avkrysning
        etikett={`Legg inn leksa «${l.tittel}»`}
        checked={l.valgt}
        onChange={() => send({ type: "veksle", gruppe: "lekser", forslagId: l.forslagId })}
      />
      <p className="kimeta">
        Til {l.barnNavn.join(" og ")}
        {l.usikker && <Merke tone="leire">Usikker</Merke>}
      </p>
      <div className="kifelter">
        <Tekstfelt
          etikett="Tittel"
          value={l.tittel}
          onChange={(e) => endre("tittel", e.target.value)}
          maxLength={120}
        />
        <Tekstfelt
          etikett="Fag"
          value={l.fag}
          onChange={(e) => endre("fag", e.target.value)}
          maxLength={40}
        />
        <Tekstfelt
          etikett="Frist"
          type="date"
          value={l.frist}
          onChange={(e) => endre("frist", e.target.value)}
        />
        <Tekstomrade
          etikett="Fritekst"
          value={l.fritekst}
          rows={2}
          onChange={(e) => endre("fritekst", e.target.value)}
          maxLength={1000}
        />
      </div>
    </li>
  );
}

function Avtale({
  a,
  kalendere,
  send,
}: {
  a: AvtaleRedigert;
  kalendere: { id: number; navn: string }[];
  send: Send;
}) {
  const endre = (felt: string, verdi: string | boolean | number | null) =>
    send({ type: "endre", gruppe: "avtaler", forslagId: a.forslagId, felt, verdi });
  return (
    <li className={a.valgt ? "kiforslag" : "kiforslag av"}>
      <Avkrysning
        etikett={`Legg inn avtalen «${a.tittel}»`}
        checked={a.valgt}
        onChange={() => send({ type: "veksle", gruppe: "avtaler", forslagId: a.forslagId })}
      />
      <p className="kimeta">
        {a.barnNavn.length > 0 ? `Gjelder ${a.barnNavn.join(" og ")}` : "Gjelder alle"}
        {a.usikker && <Merke tone="leire">Usikker</Merke>}
      </p>
      <div className="kifelter">
        <Tekstfelt
          etikett="Hva"
          value={a.tittel}
          onChange={(e) => endre("tittel", e.target.value)}
          maxLength={80}
        />
        <Valgfelt
          etikett="Kalender"
          value={a.kalenderId ?? ""}
          onChange={(e) => endre("kalenderId", e.target.value ? Number(e.target.value) : null)}
        >
          <option value="">Velg kalender</option>
          {kalendere.map((k) => (
            <option key={k.id} value={k.id}>
              {k.navn}
            </option>
          ))}
        </Valgfelt>
        <Tekstfelt
          etikett="Dato"
          type="date"
          value={a.dato}
          onChange={(e) => endre("dato", e.target.value)}
        />
        <div className="tidrad">
          <Tekstfelt
            etikett="Fra klokka (tom for hel dag)"
            type="time"
            value={a.fra}
            onChange={(e) => endre("fra", e.target.value)}
          />
          <Tekstfelt
            etikett="Til klokka"
            type="time"
            value={a.til}
            onChange={(e) => endre("til", e.target.value)}
          />
        </div>
        <Tekstfelt
          etikett="Sted"
          value={a.sted}
          onChange={(e) => endre("sted", e.target.value)}
          maxLength={80}
        />
        <Avkrysning
          etikett="Gjentas hver uke"
          checked={a.gjentas}
          onChange={(e) => endre("gjentas", e.target.checked)}
        />
        {a.gjentas && (
          <Tekstfelt
            etikett="Gjentas til og med"
            type="date"
            value={a.gjentasTil}
            min={a.dato}
            onChange={(e) => endre("gjentasTil", e.target.value)}
          />
        )}
      </div>
    </li>
  );
}

const UKEDAGER = ["Mandag", "Tirsdag", "Onsdag", "Torsdag", "Fredag", "Lørdag", "Søndag"];

function Paaminnelse({ p, send }: { p: PaaminnelseRedigert; send: Send }) {
  const endre = (felt: string, verdi: string | number) =>
    send({ type: "endre", gruppe: "paaminnelser", forslagId: p.forslagId, felt, verdi });
  const medPeriode = p.fra !== "" || p.til !== "";
  return (
    <li className={p.valgt ? "kiforslag" : "kiforslag av"}>
      <Avkrysning
        etikett={`Legg inn påminnelsen «${p.tittel}»`}
        checked={p.valgt}
        onChange={() => send({ type: "veksle", gruppe: "paaminnelser", forslagId: p.forslagId })}
      />
      <p className="kimeta">
        Til {p.barnNavn.join(" og ")}
        {p.usikker && <Merke tone="leire">Usikker</Merke>}
      </p>
      <div className="kifelter">
        <Tekstfelt
          etikett="Hva"
          value={p.tittel}
          onChange={(e) => endre("tittel", e.target.value)}
          maxLength={60}
        />
        <Valgfelt etikett="Når" value={p.slag} onChange={(e) => endre("slag", e.target.value)}>
          <option value="fast">Hver uke</option>
          <option value="dag">Bare én bestemt dag</option>
        </Valgfelt>
        {p.slag === "fast" ? (
          <>
            <Valgfelt
              etikett="Ukedag"
              value={p.ukedag}
              onChange={(e) => endre("ukedag", Number(e.target.value))}
            >
              {UKEDAGER.map((navn, i) => (
                <option key={navn} value={i}>
                  {navn}
                </option>
              ))}
            </Valgfelt>
            <Avkrysning
              etikett="Bare i en periode"
              checked={medPeriode}
              onChange={(e) => {
                endre("fra", e.target.checked ? iDag() : "");
                endre("til", e.target.checked ? leggTilDager(iDag(), 28) : "");
              }}
            />
            {medPeriode && (
              <div className="tidrad">
                <Tekstfelt
                  etikett="Første dag"
                  type="date"
                  value={p.fra}
                  onChange={(e) => endre("fra", e.target.value)}
                />
                <Tekstfelt
                  etikett="Siste dag"
                  type="date"
                  value={p.til}
                  min={p.fra}
                  onChange={(e) => endre("til", e.target.value)}
                />
              </div>
            )}
          </>
        ) : (
          <Tekstfelt
            etikett="Dato"
            type="date"
            value={p.dato}
            onChange={(e) => endre("dato", e.target.value)}
          />
        )}
      </div>
    </li>
  );
}

function Lapp({ l, send }: { l: LappRedigert; send: Send }) {
  const endre = (felt: string, verdi: string) =>
    send({ type: "endre", gruppe: "lapper", forslagId: l.forslagId, felt, verdi });
  return (
    <li className={l.valgt ? "kiforslag" : "kiforslag av"}>
      <Avkrysning
        etikett="Heng opp denne lappen"
        checked={l.valgt}
        onChange={() => send({ type: "veksle", gruppe: "lapper", forslagId: l.forslagId })}
      />
      <div className="kifelter">
        <Tekstomrade
          etikett="Tekst"
          value={l.tekst}
          rows={2}
          maxLength={280}
          hjelp={`${l.tekst.length} av 280 tegn`}
          onChange={(e) => endre("tekst", e.target.value)}
        />
        <Valgfelt etikett="Farge" value={l.farge} onChange={(e) => endre("farge", e.target.value)}>
          {LAPPFARGER.map((f) => (
            <option key={f} value={f}>
              {f}
            </option>
          ))}
        </Valgfelt>
      </div>
    </li>
  );
}

/** Forslagene i grupper. Hvert forslag har en avkrysning og felt som kan rettes før det legges inn. */
export function Forslag({
  state,
  kalendere,
  send,
}: {
  state: ForslagState;
  kalendere: { id: number; navn: string }[];
  send: Send;
}) {
  const valgt = (xs: { valgt: boolean }[]) => xs.filter((x) => x.valgt).length;
  const tomt =
    state.lekser.length +
      state.avtaler.length +
      state.paaminnelser.length +
      state.lapper.length +
      state.annet.length ===
    0;
  return (
    <div className="kiforslagliste">
      {tomt && <p className="hint">KI-en fant ikke noe å legge inn fra denne planen.</p>}
      {state.lekser.length > 0 && (
        <section aria-label="Foreslåtte lekser">
          <Gruppeoverskrift
            tittel="Lekser"
            gruppe="lekser"
            antall={state.lekser.length}
            valgt={valgt(state.lekser)}
            send={send}
          />
          <ul className="kiliste">
            {state.lekser.map((l) => (
              <Lekse key={l.forslagId} l={l} send={send} />
            ))}
          </ul>
        </section>
      )}
      {state.avtaler.length > 0 && (
        <section aria-label="Avtaler i kalenderen">
          <Gruppeoverskrift
            tittel="Avtaler"
            gruppe="avtaler"
            antall={state.avtaler.length}
            valgt={valgt(state.avtaler)}
            send={send}
          />
          <ul className="kiliste">
            {state.avtaler.map((a) => (
              <Avtale key={a.forslagId} a={a} kalendere={kalendere} send={send} />
            ))}
          </ul>
        </section>
      )}
      {state.paaminnelser.length > 0 && (
        <section aria-label="Foreslåtte påminnelser">
          <Gruppeoverskrift
            tittel="Påminnelser"
            gruppe="paaminnelser"
            antall={state.paaminnelser.length}
            valgt={valgt(state.paaminnelser)}
            send={send}
          />
          <ul className="kiliste">
            {state.paaminnelser.map((p) => (
              <Paaminnelse key={p.forslagId} p={p} send={send} />
            ))}
          </ul>
        </section>
      )}
      {state.lapper.length > 0 && (
        <section aria-label="Lapper på oppslagstavla">
          <Gruppeoverskrift
            tittel="Lapper"
            gruppe="lapper"
            antall={state.lapper.length}
            valgt={valgt(state.lapper)}
            send={send}
          />
          <ul className="kiliste">
            {state.lapper.map((l) => (
              <Lapp key={l.forslagId} l={l} send={send} />
            ))}
          </ul>
        </section>
      )}
      {state.annet.length > 0 && (
        <section aria-label="Annet">
          <div className="kigruppetopp">
            <h3>
              Annet <Merke>{state.annet.length}</Merke>
            </h3>
          </div>
          <ul className="kiliste">
            {state.annet.map((a, i) => (
              <li key={`${a.tittel}-${i}`} className="kiforslag">
                <strong>{a.tittel}</strong>
                <p>{a.tekst}</p>
                <Knapp variant="tekst" onClick={() => send({ type: "annetTilLapp", indeks: i })}>
                  Gjør til lapp
                </Knapp>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
