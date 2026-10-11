import { IKONER, type Ikonnavn } from "./ikoner";

/** Størrelser fra designsystemet, i piksler. */
export const IKONSTORRELSER = { xs: 14, s: 16, m: 20, l: 24, xl: 32 } as const;

interface Props {
  navn: Ikonnavn;
  storrelse?: keyof typeof IKONSTORRELSER;
  /** Fyller ikonet, for eksempel en valgt stjerne. */
  fylt?: boolean;
  /** Ikoner er pynt som standard. Gi en tekst hvis ikonet står alene uten ord ved siden av. */
  tittel?: string;
  className?: string;
}

export function Ikon({ navn, storrelse = "m", fylt, tittel, className }: Props) {
  const Komponent = IKONER[navn];
  const px = IKONSTORRELSER[storrelse];
  return (
    <Komponent
      size={px}
      strokeWidth={1.75}
      fill={fylt ? "currentColor" : "none"}
      className={className}
      aria-hidden={tittel ? undefined : true}
      aria-label={tittel}
      role={tittel ? "img" : undefined}
    />
  );
}
