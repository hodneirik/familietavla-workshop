import { useCallback, useEffect, useRef, useState } from "react";
import { apiGet, apiPost } from "../../lib/api";
import { ventPaaJobb } from "../ki/jobb";
import { iDag } from "../../lib/dato";
import type { KiStatusSvar } from "../ki/typer";
import {
  lagMiddagBody,
  lagMiddagState,
  tidsromDatoer,
  type MiddagDagRedigert,
  type MiddagLeggInnSvar,
  type MiddagResultat,
  type Tidsrom,
} from "./kiMiddagLogikk";

export type MiddagFase = "ledig" | "jobber" | "forslag" | "legger_inn" | "ferdig";

const feilTekst = (e: unknown) => (e instanceof Error ? e.message : "Noe gikk galt");

/** Middagsforslag fra KI-en: velg tidsrom, la KI-en foreslå, rett opp og legg inn. Ingenting lagres før «Legg inn». */
export function useKiMiddag(onInnlagt: () => Promise<void>) {
  const [status, setStatus] = useState<KiStatusSvar | null>(null);
  const [fase, setFase] = useState<MiddagFase>("ledig");
  const [tidsrom, setTidsrom] = useState<Tidsrom>("resten");
  const [onsker, setOnsker] = useState("");
  const [resultat, setResultat] = useState<MiddagResultat | null>(null);
  const [dager, setDager] = useState<MiddagDagRedigert[]>([]);
  const [paaHandleliste, setPaaHandleliste] = useState(false);
  const [feil, setFeil] = useState<string | null>(null);
  const [innlagt, setInnlagt] = useState<MiddagLeggInnSvar | null>(null);
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
      // Uten status vises ikke knappen. Middagsplanen virker uansett.
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
      const { fra, til } = tidsromDatoer(iDag(), tidsrom);
      const { jobbId } = await apiPost<{ jobbId: string }>("/api/ki/middag/foresla", {
        fra,
        til,
        onsker: onsker.trim(),
      });
      const r = await ventPaaJobb<MiddagResultat>(jobbId, () => levende.current);
      if (!r) return;
      setResultat(r);
      setDager(lagMiddagState(r.forslag));
      setFase("forslag");
      void lastStatus();
    } catch (e) {
      if (!levende.current) return;
      setFeil(feilTekst(e));
      setFase("ledig");
      void lastStatus();
    }
  }, [tidsrom, onsker, lastStatus]);

  const leggInn = useCallback(async () => {
    setFeil(null);
    setFase("legger_inn");
    try {
      const r = await apiPost<MiddagLeggInnSvar>(
        "/api/ki/middag/legg-inn",
        lagMiddagBody(dager, paaHandleliste),
      );
      setInnlagt(r);
      setFase("ferdig");
      await onInnlagt();
    } catch (e) {
      setFeil(feilTekst(e));
      setFase("forslag");
    }
  }, [dager, paaHandleliste, onInnlagt]);

  const lukk = useCallback(() => {
    setFase("ledig");
    setResultat(null);
    setDager([]);
    setInnlagt(null);
    setFeil(null);
    setPaaHandleliste(false);
  }, []);

  return {
    status,
    fase,
    tidsrom,
    setTidsrom,
    onsker,
    setOnsker,
    resultat,
    dager,
    setDager,
    paaHandleliste,
    setPaaHandleliste,
    feil,
    innlagt,
    foresla,
    leggInn,
    lukk,
  };
}
