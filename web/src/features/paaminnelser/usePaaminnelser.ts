import { useCallback, useState } from "react";
import { apiGet } from "../../lib/api";
import type { Paaminnelse } from "../../lib/types";
import { usePolling } from "../../lib/usePolling";

/** Påminnelsene brukeren får se: barnets egne, eller alle barnas for voksne. Holdes oppdatert. */
export function usePaaminnelser() {
  const [paaminnelser, setPaaminnelser] = useState<Paaminnelse[]>([]);
  const [feil, setFeil] = useState<string | null>(null);

  const last = useCallback(async () => {
    try {
      setPaaminnelser(await apiGet<Paaminnelse[]>("/api/paaminnelser"));
      setFeil(null);
    } catch (e) {
      setFeil(e instanceof Error ? e.message : "Noe gikk galt");
    }
  }, []);
  usePolling(last);

  return { paaminnelser, feil, setFeil, last };
}
