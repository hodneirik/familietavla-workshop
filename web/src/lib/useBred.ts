import { useEffect, useState } from "react";

/** Bred skjerm, som iPaden barna deler. Da får Hjem to kolonner. Følger med når skjermen snus. */
export const BRED = "(min-width: 900px)";

export function useBred(sporring = BRED): boolean {
  const [bred, setBred] = useState(
    () => typeof window !== "undefined" && !!window.matchMedia?.(sporring).matches,
  );
  useEffect(() => {
    const mq = window.matchMedia?.(sporring);
    if (!mq) return;
    const endret = () => setBred(mq.matches);
    endret();
    mq.addEventListener("change", endret);
    return () => mq.removeEventListener("change", endret);
  }, [sporring]);
  return bred;
}
