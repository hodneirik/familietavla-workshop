import { useRef, type ButtonHTMLAttributes, type MouseEvent } from "react";
import { AnimertIkon, type IkonSpill } from "./AnimertIkon";
import { Ikon } from "./Ikon";
import type { Ikonnavn } from "./ikoner";

export type Knappvariant = "primær" | "sekundær" | "fare" | "tekst";
export type Knappstorrelse = "vanlig" | "stor";

interface KnappProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Knappvariant;
  /** «stor» er trykkvarianten, for hovedhandlinger på iPaden. */
  storrelse?: Knappstorrelse;
  ikon?: Ikonnavn;
}

export function klasserForKnapp(variant: Knappvariant, storrelse: Knappstorrelse): string {
  return ["knapp", `knapp--${variant}`, storrelse === "stor" ? "knapp--stor" : ""]
    .filter(Boolean)
    .join(" ");
}

/** Knapp med tekst, og eventuelt et ikon foran. Bruk IkonKnapp når det ikke er plass til tekst. */
export function Knapp({
  variant = "sekundær",
  storrelse = "vanlig",
  ikon,
  className,
  type = "button",
  onClick,
  children,
  ...rest
}: KnappProps) {
  const spill = useRef<IkonSpill>(null);
  const trykk = (e: MouseEvent<HTMLButtonElement>) => {
    spill.current?.spill();
    onClick?.(e);
  };
  return (
    <button
      type={type}
      className={[klasserForKnapp(variant, storrelse), className].filter(Boolean).join(" ")}
      onClick={trykk}
      {...rest}
    >
      {ikon && <AnimertIkon ref={spill} navn={ikon} storrelse="m" />}
      {children}
    </button>
  );
}

interface IkonKnappProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  ikon: Ikonnavn;
  /** Står alene uten tekst, så den må ha et navn for skjermlesere. */
  tittel: string;
  variant?: Knappvariant;
}

export function IkonKnapp({
  ikon,
  tittel,
  variant = "sekundær",
  className,
  type = "button",
  ...rest
}: IkonKnappProps) {
  return (
    <button
      type={type}
      aria-label={tittel}
      title={tittel}
      className={[klasserForKnapp(variant, "vanlig"), "knapp--ikon", className]
        .filter(Boolean)
        .join(" ")}
      {...rest}
    >
      <Ikon navn={ikon} storrelse="m" />
    </button>
  );
}
