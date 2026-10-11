import type { ReactNode } from "react";
import { Ikon } from "./Ikon";
import type { Ikonnavn } from "./ikoner";

export type Merketone = "noytral" | "gronn" | "sand" | "leire" | "skifer";

/** Lite merke for status og tall, for eksempel «Venter» eller antall poeng. */
export function Merke({
  tone = "noytral",
  ikon,
  ikonFylt,
  children,
}: {
  tone?: Merketone;
  ikon?: Ikonnavn;
  /** Fyller ikonet, for eksempel en stjerne. */
  ikonFylt?: boolean;
  children: ReactNode;
}) {
  return (
    <span className={`merke merke--${tone}`}>
      {ikon && (
        <Ikon
          navn={ikon}
          storrelse="xs"
          fylt={ikonFylt}
          className={ikonFylt ? "stjerne" : undefined}
        />
      )}
      {children}
    </span>
  );
}
