import { createRef, useMemo, type CSSProperties } from "react";
import { lesbarTekstfarge } from "../lib/farge";
import { AnimertIkon, type IkonSpill } from "./AnimertIkon";
import type { Ikonnavn } from "./ikoner";

export interface Menyvalg {
  id: string;
  navn: string;
  ikon: Ikonnavn;
}

/**
 * Menyen nederst. Den har samme farge som profilbildet, så man ser med en gang
 * hvem som er logget inn.
 */
export function Bunnmeny({
  valg,
  aktiv,
  onVelg,
  farge,
}: {
  valg: Menyvalg[];
  aktiv: string | undefined;
  onVelg: (id: string) => void;
  farge: string;
}) {
  // Hvert ikon får en egen ref, så vi kan spille animasjonen når knappen trykkes
  const spillere = useMemo(() => new Map(valg.map((v) => [v.id, createRef<IkonSpill>()])), [valg]);
  return (
    <nav
      className="bunnmeny"
      aria-label="Hovedmeny"
      style={{ "--meny-bg": farge, "--meny-fg": lesbarTekstfarge(farge) } as CSSProperties}
    >
      {valg.map((v) => (
        <button
          key={v.id}
          type="button"
          className={v.id === aktiv ? "aktiv" : ""}
          aria-current={v.id === aktiv ? "page" : undefined}
          onClick={() => {
            spillere.get(v.id)?.current?.spill();
            onVelg(v.id);
          }}
        >
          <AnimertIkon ref={spillere.get(v.id)} navn={v.ikon} storrelse="l" />
          <span>{v.navn}</span>
        </button>
      ))}
    </nav>
  );
}
