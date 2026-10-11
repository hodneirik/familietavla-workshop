import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { apiGet, apiPost, apiPut } from "../../lib/api";
import { iDag } from "../../lib/dato";
import {
  base64FraBytes,
  forslagReducer,
  lagForslagState,
  lagLeggInnBody,
  lagSvarListe,
  slaaSammenSvar,
  standardUke,
} from "./forslagLogikk";
import type {
  AnalyseResultat,
  Duplikat,
  JobbSvar,
  KiInnstillingerSvar,
  KiStatusSvar,
  LeggInnSvar,
  SvarRad,
} from "./typer";

export const MAKS_PDF_MB = 10;
const MAKS_RUNDER = 3;
const POLL_MS = 2000;
const GI_OPP_MS = 4 * 60_000;

export type Fase = "ledig" | "analyserer" | "spoersmaal" | "forslag" | "legger_inn" | "ferdig";

export interface Pdf {
  navn: string;
  base64: string;
}

const feilTekst = (e: unknown) => (e instanceof Error ? e.message : "Noe gikk galt");

/** Hele flyten: last opp, la KI-en lese, svar på spørsmål, rediger forslagene og legg inn. */
export function useKi() {
  const [status, setStatus] = useState<KiStatusSvar | null>(null);
  const [fase, setFase] = useState<Fase>("ledig");
  const [pdf, setPdf] = useState<Pdf | null>(null);
  const [uke, setUke] = useState(() => standardUke(iDag()));
  const [barnIder, setBarnIder] = useState<number[]>([]);
  const [svar, setSvar] = useState<SvarRad[]>([]);
  const [runde, setRunde] = useState(0);
  const [analyse, setAnalyse] = useState<AnalyseResultat | null>(null);
  const [duplikat, setDuplikat] = useState<Duplikat | null>(null);
  const [feil, setFeil] = useState<string | null>(null);
  const [resultat, setResultat] = useState<LeggInnSvar | null>(null);
  const [forslag, dispatch] = useReducer(forslagReducer, {
    lekser: [],
    avtaler: [],
    paaminnelser: [],
    lapper: [],
    annet: [],
  });
  const [innst, setInnst] = useState<KiInnstillingerSvar | null>(null);
  const levende = useRef(true);

  useEffect(() => {
    levende.current = true;
    return () => {
      levende.current = false;
    };
  }, []);

  const lastStatus = useCallback(async () => {
    try {
      setStatus(await apiGet<KiStatusSvar>("/api/ki/status"));
    } catch (e) {
      setFeil(feilTekst(e));
    }
  }, []);
  const lastInnstillinger = useCallback(async () => {
    try {
      setInnst(await apiGet<KiInnstillingerSvar>("/api/ki/innstillinger"));
    } catch (e) {
      setFeil(feilTekst(e));
    }
  }, []);
  useEffect(() => {
    void lastStatus();
    void lastInnstillinger();
  }, [lastStatus, lastInnstillinger]);

  const velgFil = useCallback(async (fil: File | null) => {
    setFeil(null);
    setDuplikat(null);
    if (!fil) return setPdf(null);
    if (fil.type !== "application/pdf" && !fil.name.toLowerCase().endsWith(".pdf")) {
      return setFeil("Velg en PDF-fil.");
    }
    if (fil.size > MAKS_PDF_MB * 1024 * 1024) {
      return setFeil(`PDF-en er for stor. Høyst ${MAKS_PDF_MB} MB.`);
    }
    try {
      setPdf({ navn: fil.name, base64: base64FraBytes(new Uint8Array(await fil.arrayBuffer())) });
    } catch {
      setFeil("Kunne ikke lese filen.");
    }
  }, []);

  const ventPaaJobb = useCallback(async (jobbId: string): Promise<AnalyseResultat> => {
    const slutt = Date.now() + GI_OPP_MS;
    while (Date.now() < slutt) {
      await new Promise((r) => setTimeout(r, POLL_MS));
      if (!levende.current) throw new Error("Avbrutt");
      const j = await apiGet<JobbSvar>(`/api/ki/jobber/${jobbId}`);
      if (j.status === "feil") throw new Error(j.melding);
      if (j.status === "ferdig") return j.resultat;
    }
    throw new Error("Analysen tok for lang tid. Prøv igjen.");
  }, []);

  const analyser = useCallback(
    async (svarListe: SvarRad[], bekreftDuplikat = false, nyRunde = 0) => {
      if (!pdf) return;
      setFeil(null);
      setFase("analyserer");
      try {
        const start = await apiPost<{ jobbId?: string; duplikat?: Duplikat }>(
          "/api/ki/ukeplan/analyser",
          {
            pdfBase64: pdf.base64,
            ukeStart: uke,
            barnIder,
            svar: svarListe,
            bekreftDuplikat,
          },
        );
        if (start.duplikat) {
          setDuplikat(start.duplikat);
          setFase("ledig");
          return;
        }
        setDuplikat(null);
        const r = await ventPaaJobb(start.jobbId!);
        if (!levende.current) return;
        setAnalyse(r);
        setRunde(nyRunde);
        dispatch({ type: "sett", state: lagForslagState(r) });
        setFase(
          r.forslag.spoersmaal.length > 0 && nyRunde < MAKS_RUNDER ? "spoersmaal" : "forslag",
        );
        void lastStatus();
      } catch (e) {
        if (!levende.current) return;
        setFeil(feilTekst(e));
        setFase(analyse ? "forslag" : "ledig");
        void lastStatus();
      }
    },
    [pdf, uke, barnIder, ventPaaJobb, analyse, lastStatus],
  );

  const start = useCallback(
    (bekreftDuplikat = false) => {
      setSvar([]);
      void analyser([], bekreftDuplikat, 1);
    },
    [analyser],
  );

  /** Neste runde etter at forelderen har svart. Tidligere svar tas med. */
  const sendSvar = useCallback(
    (valgt: Record<string, string>) => {
      if (!analyse) return;
      const alle = slaaSammenSvar(svar, lagSvarListe(analyse.forslag.spoersmaal, valgt));
      setSvar(alle);
      void analyser(alle, true, runde + 1);
    },
    [analyse, svar, analyser, runde],
  );

  const leggInn = useCallback(async () => {
    if (!analyse) return;
    setFeil(null);
    setFase("legger_inn");
    try {
      const r = await apiPost<LeggInnSvar>(
        "/api/ki/ukeplan/legg-inn",
        lagLeggInnBody(forslag, analyse.forslag.ukeStart, analyse.kontrollsum),
      );
      setResultat(r);
      setFase("ferdig");
    } catch (e) {
      setFeil(feilTekst(e));
      setFase("forslag");
    }
  }, [analyse, forslag]);

  const nullstill = useCallback(() => {
    setFase("ledig");
    setPdf(null);
    setSvar([]);
    setRunde(0);
    setAnalyse(null);
    setBarnIder([]);
    setDuplikat(null);
    setResultat(null);
    setFeil(null);
    void lastStatus();
  }, [lastStatus]);

  const lagreInnstillinger = useCallback(
    async (data: {
      barn: { barnId: number; klasse: string | null }[];
      regler: string;
      standardKalenderId: number | null;
      voksne: number;
      middagRegler: string;
    }) => {
      const ny = await apiPut<KiInnstillingerSvar>("/api/ki/innstillinger", data);
      setInnst(ny);
    },
    [],
  );

  return {
    status,
    innst,
    fase,
    pdf,
    uke,
    setUke,
    barnIder,
    setBarnIder,
    runde,
    analyse,
    duplikat,
    feil,
    resultat,
    forslag,
    dispatch,
    velgFil,
    start,
    sendSvar,
    leggInn,
    nullstill,
    lagreInnstillinger,
    lastStatus,
    lastInnstillinger,
    visForslag: () => setFase("forslag"),
  };
}
