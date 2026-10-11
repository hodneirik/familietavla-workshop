import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { ApiError, apiGet, apiPost } from "../lib/api";
import type { Bruker } from "../lib/types";

interface Auth {
  bruker: Bruker | null;
  laster: boolean;
  loggInn: (userId: number, pin: string) => Promise<void>;
  loggUt: () => Promise<void>;
  /** Bytter ut den innloggede brukeren med en oppdatert utgave, f.eks. etter ny emoji. */
  oppdaterBruker: (bruker: Bruker) => void;
}

const Ctx = createContext<Auth | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [bruker, setBruker] = useState<Bruker | null>(null);
  const [laster, setLaster] = useState(true);

  useEffect(() => {
    apiGet<{ bruker: Bruker }>("/api/auth/me")
      .then((r) => setBruker(r.bruker))
      .catch((e) => {
        if (!(e instanceof ApiError && e.status === 401)) console.error(e);
      })
      .finally(() => setLaster(false));
  }, []);

  const loggInn = useCallback(async (userId: number, pin: string) => {
    const r = await apiPost<{ bruker: Bruker }>("/api/auth/login", { userId, pin });
    setBruker(r.bruker);
  }, []);

  const loggUt = useCallback(async () => {
    await apiPost("/api/auth/logout");
    setBruker(null);
  }, []);

  return (
    <Ctx.Provider value={{ bruker, laster, loggInn, loggUt, oppdaterBruker: setBruker }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth(): Auth {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth må brukes inni AuthProvider");
  return v;
}
