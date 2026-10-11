import { useEffect, useRef, type ReactNode } from "react";
import { Ikon } from "./Ikon";
import type { Ikonnavn } from "./ikoner";

export type Infotype = "info" | "ok" | "advarsel" | "feil";

const IKON: Record<Infotype, Ikonnavn> = {
  info: "info",
  ok: "ok",
  advarsel: "advarsel",
  feil: "feil",
};

/** Melding til den som bruker appen. Feil leses opp med en gang, de andre er rolige statusmeldinger. */
export function Infoboks({
  type = "info",
  tittel,
  children,
}: {
  type?: Infotype;
  tittel?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  // Meldinger som dukker opp utenfor skjermen, for eksempel etter at man har scrollet ned til et skjema
  useEffect(() => {
    ref.current?.scrollIntoView?.({ block: "nearest" });
  }, []);
  return (
    <div
      ref={ref}
      className={`infoboks infoboks--${type}`}
      role={type === "feil" ? "alert" : "status"}
    >
      <Ikon navn={IKON[type]} storrelse="l" />
      <div className="infoboks__tekst">
        {tittel && <p className="infoboks__tittel">{tittel}</p>}
        <div>{children}</div>
      </div>
    </div>
  );
}
