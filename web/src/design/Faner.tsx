import { useId, type KeyboardEvent, type ReactNode } from "react";

export interface Fanevalg {
  id: string;
  navn: string;
}

/**
 * Faner øverst på en side: én og én del vises om gangen. Piltastene flytter mellom fanene, og
 * innholdet i den valgte fanen settes i `Fanepanel`. Ikke det samme som menyen nederst.
 */
export function Faner({
  valg,
  aktiv,
  onVelg,
  etikett,
  children,
}: {
  valg: Fanevalg[];
  aktiv: string;
  onVelg: (id: string) => void;
  /** Hva fanene deler opp, for skjermlesere. */
  etikett: string;
  /** Panelet for den valgte fanen. */
  children: ReactNode;
}) {
  const prefiks = useId();
  const tabId = (id: string) => `${prefiks}-fane-${id}`;
  const panelId = (id: string) => `${prefiks}-panel-${id}`;

  const flytt = (e: KeyboardEvent<HTMLButtonElement>, indeks: number) => {
    const slutt = valg.length - 1;
    const til =
      e.key === "ArrowRight"
        ? indeks === slutt
          ? 0
          : indeks + 1
        : e.key === "ArrowLeft"
          ? indeks === 0
            ? slutt
            : indeks - 1
          : e.key === "Home"
            ? 0
            : e.key === "End"
              ? slutt
              : null;
    if (til === null) return;
    e.preventDefault();
    const neste = valg[til]!;
    onVelg(neste.id);
    document.getElementById(tabId(neste.id))?.focus();
  };

  return (
    <div className="faner">
      <div className="faner__liste" role="tablist" aria-label={etikett}>
        {valg.map((v, i) => (
          <button
            key={v.id}
            type="button"
            role="tab"
            id={tabId(v.id)}
            aria-selected={v.id === aktiv}
            aria-controls={panelId(v.id)}
            tabIndex={v.id === aktiv ? 0 : -1}
            className={v.id === aktiv ? "faner__fane aktiv" : "faner__fane"}
            onClick={() => onVelg(v.id)}
            onKeyDown={(e) => flytt(e, i)}
          >
            {v.navn}
          </button>
        ))}
      </div>
      <div
        role="tabpanel"
        id={panelId(aktiv)}
        aria-labelledby={tabId(aktiv)}
        className="faner__panel"
      >
        {children}
      </div>
    </div>
  );
}
