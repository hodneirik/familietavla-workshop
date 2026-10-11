import { useEffect } from "react";
import { Ikon } from "../../design/Ikon";

/** Alle PIN-koder er 4 sifre. */
export const PIN_LENGDE = 4;

interface Props {
  lengde: number;
  verdi: string;
  onChange: (v: string) => void;
  onFerdig: (pin: string) => void;
  disabled?: boolean;
}

export function PinPad({ lengde, verdi, onChange, onFerdig, disabled }: Props) {
  const trykk = (siffer: string) => {
    if (disabled || verdi.length >= lengde) return;
    const ny = verdi + siffer;
    onChange(ny);
    if (ny.length === lengde) onFerdig(ny);
  };
  const slett = () => !disabled && onChange(verdi.slice(0, -1));

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (/^\d$/.test(e.key)) trykk(e.key);
      else if (e.key === "Backspace") slett();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  });

  return (
    <div className="pinpad">
      <div className="pinprikker" role="img" aria-label={`${verdi.length} av ${lengde} sifre`}>
        {Array.from({ length: lengde }, (_, i) => (
          <span key={i} className={i < verdi.length ? "fylt" : ""} />
        ))}
      </div>
      <div className="taster">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((s) => (
          <button key={s} type="button" onClick={() => trykk(s)} disabled={disabled}>
            {s}
          </button>
        ))}
        <span />
        <button type="button" onClick={() => trykk("0")} disabled={disabled}>
          0
        </button>
        <button
          type="button"
          className="slett"
          onClick={slett}
          disabled={disabled}
          aria-label="Slett"
        >
          <Ikon navn="slett_tegn" storrelse="l" />
        </button>
      </div>
    </div>
  );
}
