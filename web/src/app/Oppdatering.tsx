import { useEffect, useState } from "react";
import { Knapp } from "../design/Knapp";
import { harNyVersjon } from "../lib/versjon";

/** Hvor ofte det sjekkes mens appen er åpen. Ellers sjekkes det når appen åpnes igjen. */
const SJEKK_MS = 5 * 60_000;

/** Holder øye med om det har kommet en ny versjon av appen, og sier fra når det er tid for å laste på nytt. */
export function useNyVersjon(): boolean {
  const [ny, setNy] = useState(false);
  useEffect(() => {
    let aktiv = true;
    const sjekk = async () => {
      if (document.visibilityState !== "visible") return;
      if (await harNyVersjon()) if (aktiv) setNy(true);
    };
    void sjekk();
    const timer = setInterval(() => void sjekk(), SJEKK_MS);
    // En app lagt på hjemskjermen fryses i bakgrunnen, så vi sjekker når den vises igjen
    document.addEventListener("visibilitychange", sjekk);
    window.addEventListener("pageshow", sjekk);
    return () => {
      aktiv = false;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", sjekk);
      window.removeEventListener("pageshow", sjekk);
    };
  }, []);
  return ny;
}

/** Stripen øverst som tilbyr å laste appen på nytt. Ingenting lastes av seg selv, så ingen mister det de skriver. */
export function Oppdateringsstripe({ ny, onOppdater }: { ny: boolean; onOppdater: () => void }) {
  if (!ny) return null;
  return (
    <div className="oppdatering" role="status">
      <span>Ny versjon av appen er klar.</span>
      <Knapp variant="primær" onClick={onOppdater}>
        Oppdater
      </Knapp>
    </div>
  );
}
