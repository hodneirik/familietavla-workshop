import { useCallback, useEffect, useRef, useState } from "react";
import { apiGet, apiPost } from "../../lib/api";
import { ventPaaJobb } from "../ki/jobb";
import type { KiStatusSvar } from "../ki/typer";
import {
  lagRetterBody,
  lagRetterState,
  type RettRedigert,
  type RetterLeggInnSvar,
  type RetterResultat,
} from "./kiRetterLogikk";

export type RetterFase = "ledig" | "jobber" | "forslag" | "legger_inn" | "ferdig";

const feilTekst = (e: unknown) => (e instanceof Error ? e.message : "Noe gikk galt");

/** Nye middagsretter fra KI-en: beskriv hva du vil ha, rett opp forslagene og legg dem til. Ingenting lagres før «Legg til». */
export function useKiRetter(onInnlagt: () => Promise<void>) {
  const [status, setStatus] = useState<KiStatusSvar | null>(null);
  const [fase, setFase] = useState<RetterFase>("ledig");
  const [onsker, setOnsker] = useState("");
  const [antall, setAntall] = useState(5);
  const [resultat, setResultat] = useState<RetterResultat | null>(null);
  const [retter, setRetter] = useState<RettRedigert[]>([]);
  const [feil, setFeil] = useState<string | null>(null);
  const [innlagt, setInnlagt] = useState<RetterLeggInnSvar | null>(null);
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
    } catch {
      setStatus(null);
    }
  }, []);
  useEffect(() => {
    void lastStatus();
  }, [lastStatus]);

  const foresla = useCallback(async () => {
    setFeil(null);
    setFase("jobber");
    try {
      const { jobbId } = await apiPost<{ jobbId: string }>("/api/ki/retter/foresla", {
        onsker: onsker.trim(),
        antall,
      });
      const r = await ventPaaJobb<RetterResultat>(jobbId, () => levende.current);
      if (!r) return;
      setResultat(r);
      setRetter(lagRetterState(r.forslag));
      setFase("forslag");
      void lastStatus();
    } catch (e) {
      if (!levende.current) return;
      setFeil(feilTekst(e));
      setFase("ledig");
      void lastStatus();
    }
  }, [onsker, antall, lastStatus]);

  const leggInn = useCallback(async () => {
    setFeil(null);
    setFase("legger_inn");
    try {
      setInnlagt(
        await apiPost<RetterLeggInnSvar>("/api/ki/retter/legg-inn", lagRetterBody(retter)),
      );
      setFase("ferdig");
      await onInnlagt();
    } catch (e) {
      setFeil(feilTekst(e));
      setFase("forslag");
    }
  }, [retter, onInnlagt]);

  const lukk = useCallback(() => {
    setFase("ledig");
    setResultat(null);
    setRetter([]);
    setInnlagt(null);
    setFeil(null);
  }, []);

  return {
    status,
    fase,
    onsker,
    setOnsker,
    antall,
    setAntall,
    resultat,
    retter,
    setRetter,
    feil,
    innlagt,
    foresla,
    leggInn,
    lukk,
  };
}
