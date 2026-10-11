import type { Bruker } from "../lib/types";
import { lesbarTekstfarge } from "../lib/farge";

/** Toppen av appen: navnet på tavla, og hvem som er logget inn. Trykk på profilen for å gå til «Meg». */
export function Toppmeny({ bruker, onProfil }: { bruker: Bruker; onProfil: () => void }) {
  return (
    <header className="toppmeny">
      <h1>Familietavla</h1>
      <button
        type="button"
        className="toppmeny__bruker"
        onClick={onProfil}
        aria-label={`Min profil, ${bruker.visningsnavn}`}
      >
        <span
          className="toppmeny__bilde"
          style={{ background: bruker.farge, color: lesbarTekstfarge(bruker.farge) }}
          aria-hidden="true"
        >
          {bruker.emoji ?? bruker.visningsnavn.slice(0, 1).toUpperCase()}
        </span>
        <span className="toppmeny__navn">{bruker.visningsnavn}</span>
      </button>
    </header>
  );
}
