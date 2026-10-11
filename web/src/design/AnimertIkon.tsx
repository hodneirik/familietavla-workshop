import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  type ComponentType,
  type ForwardRefExoticComponent,
  type HTMLAttributes,
  type RefAttributes,
} from "react";
import { BookTextIcon } from "./animert/book-text";
import { CalendarDaysIcon } from "./animert/calendar-days";
import { CartIcon } from "./animert/cart";
import { CheckIcon } from "./animert/check";
import { ClipboardCheckIcon } from "./animert/clipboard-check";
import { ClockIcon } from "./animert/clock";
import { CloudLightningIcon } from "./animert/cloud-lightning";
import { CloudRainIcon } from "./animert/cloud-rain";
import { CloudSnowIcon } from "./animert/cloud-snow";
import { CloudSunIcon } from "./animert/cloud-sun";
import { HandIcon } from "./animert/hand";
import { HomeIcon } from "./animert/home";
import { LogoutIcon } from "./animert/logout";
import { PaletteIcon } from "./animert/palette";
import { PlusIcon } from "./animert/plus";
import { SettingsIcon } from "./animert/settings";
import { SnowflakeIcon } from "./animert/snowflake";
import { SoupIcon } from "./animert/soup";
import { SunIcon } from "./animert/sun";
import { ThermometerIcon } from "./animert/thermometer";
import { UserIcon } from "./animert/user";
import { UsersIcon } from "./animert/users";
import { Ikon, IKONSTORRELSER } from "./Ikon";
import { HaglIkon, SolRegnIkon, TakeIkon } from "./Tofarget";
import type { Ikonnavn } from "./ikoner";

interface Styrbart {
  startAnimation: () => void;
  stopAnimation: () => void;
}
type AnimertKomponent = ForwardRefExoticComponent<
  HTMLAttributes<HTMLDivElement> & { size?: number } & RefAttributes<Styrbart>
>;

/** Ikonene som har en animert utgave fra lucide-animated.com. Resten vises uten animasjon. */
export const ANIMERTE: Partial<Record<Ikonnavn, AnimertKomponent>> = {
  hjem: HomeIcon,
  gjoremal: ClipboardCheckIcon,
  lekser: BookTextIcon,
  kalender: CalendarDaysIcon,
  handle: CartIcon,
  middag: SoupIcon,
  familie: UsersIcon,
  meg: UserIcon,
  legg_til: PlusIcon,
  hand: HandIcon,
  hake: CheckIcon,
  klokke: ClockIcon,
  innstillinger: SettingsIcon,
  palett: PaletteIcon,
  logg_ut: LogoutIcon,
  sol: SunIcon,
  sol_sky: CloudSunIcon,
  regn: CloudRainIcon,
  snø: SnowflakeIcon,
  snøbyger: CloudSnowIcon,
  torden: CloudLightningIcon,
  temperatur: ThermometerIcon,
};

/** Værikoner uten animasjon, tegnet med grå sky og farget innhold. */
const TOFARGET: Partial<Record<Ikonnavn, ComponentType<{ size?: number; className?: string }>>> = {
  sol_regn: SolRegnIkon,
  tåke: TakeIkon,
  hagl: HaglIkon,
};

export const harAnimasjon = (navn: Ikonnavn): boolean => navn in ANIMERTE;

/** Folk som har bedt om mindre bevegelse i systemet, får ikke ikonene til å bevege seg. */
function vilHaRoligAppen(): boolean {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

export interface IkonSpill {
  /** Spiller animasjonen en gang. Gjør ingenting for ikoner uten animasjon. */
  spill: () => void;
}

interface Props {
  navn: Ikonnavn;
  storrelse?: keyof typeof IKONSTORRELSER;
  className?: string;
  /** Spiller animasjonen like etter at ikonet dukker opp. Tallet er ventetid i millisekunder. */
  spillVedStart?: number;
}

/** Ikon som kan animeres. Bruk ref og `spill()`, for eksempel når man trykker på en knapp. */
export const AnimertIkon = forwardRef<IkonSpill, Props>(function AnimertIkon(
  { navn, storrelse = "m", className, spillVedStart },
  ref,
) {
  const inner = useRef<Styrbart>(null);
  const spill = () => {
    if (!vilHaRoligAppen()) inner.current?.startAnimation();
  };
  useImperativeHandle(ref, () => ({ spill }));

  useEffect(() => {
    if (spillVedStart === undefined) return;
    const t = window.setTimeout(() => {
      if (!vilHaRoligAppen()) inner.current?.startAnimation();
    }, spillVedStart);
    return () => window.clearTimeout(t);
  }, [spillVedStart]);

  const Komponent = ANIMERTE[navn];
  if (!Komponent) {
    const Tofarget = TOFARGET[navn];
    if (Tofarget) return <Tofarget size={IKONSTORRELSER[storrelse]} className={className} />;
    return <Ikon navn={navn} storrelse={storrelse} className={className} />;
  }
  return (
    <Komponent
      ref={inner}
      size={IKONSTORRELSER[storrelse]}
      className={["animert-ikon", className].filter(Boolean).join(" ")}
      aria-hidden="true"
    />
  );
});
