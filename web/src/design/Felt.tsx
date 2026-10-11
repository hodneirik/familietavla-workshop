import {
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { AnimertIkon } from "./AnimertIkon";

interface FeltRamme {
  etikett: string;
  hjelp?: string;
  feil?: string | null;
}

interface FeltEgenskaper {
  id: string;
  "aria-describedby"?: string;
  "aria-invalid"?: true;
}

/** Etikett, hjelpetekst og feilmelding rundt et skjemafelt. Selve feltet får id og beskrivelse av oss. */
export function Felt({
  etikett,
  hjelp,
  feil,
  children,
}: FeltRamme & { children: (egenskaper: FeltEgenskaper) => ReactNode }) {
  const id = useId();
  const hjelpId = `${id}-hjelp`;
  const feilId = `${id}-feil`;
  const beskrivelse = [hjelp ? hjelpId : null, feil ? feilId : null].filter(Boolean).join(" ");
  return (
    <div className="felt">
      <label htmlFor={id} className="felt__etikett">
        {etikett}
      </label>
      {children({
        id,
        "aria-describedby": beskrivelse || undefined,
        "aria-invalid": feil ? true : undefined,
      })}
      {hjelp && (
        <p id={hjelpId} className="felt__hjelp">
          {hjelp}
        </p>
      )}
      {feil && (
        <p id={feilId} className="felt__feil" role="alert">
          {feil}
        </p>
      )}
    </div>
  );
}

export function Tekstfelt({
  etikett,
  hjelp,
  feil,
  ...rest
}: FeltRamme & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <Felt etikett={etikett} hjelp={hjelp} feil={feil}>
      {(egenskaper) => <input {...egenskaper} {...rest} />}
    </Felt>
  );
}

export function Valgfelt({
  etikett,
  hjelp,
  feil,
  children,
  ...rest
}: FeltRamme & SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <Felt etikett={etikett} hjelp={hjelp} feil={feil}>
      {(egenskaper) => (
        <select {...egenskaper} {...rest}>
          {children}
        </select>
      )}
    </Felt>
  );
}

export function Tekstomrade({
  etikett,
  hjelp,
  feil,
  ...rest
}: FeltRamme & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <Felt etikett={etikett} hjelp={hjelp} feil={feil}>
      {(egenskaper) => <textarea rows={3} {...egenskaper} {...rest} />}
    </Felt>
  );
}

/** Avkrysningsboks med hake som tegnes inn. Selve feltet er skjult, men virker med tastatur og skjermleser. */
export function Avkrysning({
  etikett,
  ...rest
}: { etikett: string } & Omit<InputHTMLAttributes<HTMLInputElement>, "type">) {
  return (
    <label className="avkrysning">
      <input type="checkbox" {...rest} />
      <span className={rest.checked ? "rute huket" : "rute"} aria-hidden="true">
        {rest.checked && <AnimertIkon navn="hake" storrelse="m" spillVedStart={0} />}
      </span>
      <span>{etikett}</span>
    </label>
  );
}
