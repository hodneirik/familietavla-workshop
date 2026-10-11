/**
 * Værikoner som ikke finnes animert, tegnet i to eller tre farger: skyen er alltid grå
 * (--sky-ikon), solen er gul (--sol), og regn og annet følger fargen på ikonet (currentColor).
 * Banene er fra Lucide (ISC-lisens).
 */
import type { ReactNode } from "react";

interface Props {
  size?: number;
  className?: string;
}

function Ramme({ size = 24, className, children }: Props & { children: ReactNode }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

const SKY = "var(--sky-ikon)";
const SOL = "var(--sol)";

/** Sol med sky og regn: gul sol, grå sky og regn i ikonets farge. */
export function SolRegnIkon(props: Props) {
  return (
    <Ramme {...props}>
      <g stroke={SOL}>
        <path d="M12 2v2" />
        <path d="m4.93 4.93 1.41 1.41" />
        <path d="M20 12h2" />
        <path d="m19.07 4.93-1.41 1.41" />
        <path d="M15.947 12.65a4 4 0 0 0-5.925-4.128" />
      </g>
      <path d="M3 20a5 5 0 1 1 8.9-4H13a3 3 0 0 1 2 5.24" stroke={SKY} />
      <path d="M11 20v2" />
      <path d="M7 19v2" />
    </Ramme>
  );
}

/** Tåke: alt i grått. */
export function TakeIkon(props: Props) {
  return (
    <Ramme {...props}>
      <g stroke={SKY}>
        <path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242" />
        <path d="M16 17H7" />
        <path d="M17 21H9" />
      </g>
    </Ramme>
  );
}

/** Hagl: grå sky, og haglet i ikonets farge. */
export function HaglIkon(props: Props) {
  return (
    <Ramme {...props}>
      <path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242" stroke={SKY} />
      <path d="M16 14v2" />
      <path d="M8 14v2" />
      <path d="M16 20h.01" />
      <path d="M8 20h.01" />
      <path d="M12 16v2" />
      <path d="M12 22h.01" />
    </Ramme>
  );
}
