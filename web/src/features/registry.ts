import type { ComponentType } from "react";
import type { Ikonnavn } from "../design/ikoner";
import type { Rolle } from "../lib/types";
import { Calendar } from "./calendar/Calendar";
import { Gjoremal } from "./gjoremal/Gjoremal";
import { Handleliste } from "./handleliste/Handleliste";
import { Hjem } from "./hjem/Hjem";
import { Lekser } from "./lekser/Lekser";
import { Middag } from "./middag/Middag";
import { Profile } from "./profile/Profile";

export interface Fane {
  id: string;
  navn: string;
  ikon: Ikonnavn;
  paa: boolean;
  roller: Rolle[];
  komponent: ComponentType;
}

/** Her legges nye faner til. Hver fane har egen på/av-bryter og rollefilter. */
export const faner: Fane[] = [
  {
    id: "hjem",
    navn: "Hjem",
    ikon: "hjem",
    paa: true,
    roller: ["forelder", "barn", "besteforelder"],
    komponent: Hjem,
  },
  {
    id: "gjoremal",
    navn: "Gjøremål",
    ikon: "gjoremal",
    paa: true,
    roller: ["forelder", "barn", "besteforelder"],
    komponent: Gjoremal,
  },
  {
    id: "skole",
    navn: "Skole",
    ikon: "lekser",
    paa: true,
    roller: ["forelder", "barn"],
    komponent: Lekser,
  },
  {
    id: "kalender",
    navn: "Kalender",
    ikon: "kalender",
    paa: true,
    roller: ["forelder"],
    komponent: Calendar,
  },
  {
    id: "handleliste",
    navn: "Handle",
    ikon: "handle",
    paa: true,
    roller: ["forelder", "barn"],
    komponent: Handleliste,
  },
  {
    id: "middag",
    navn: "Middag",
    ikon: "middag",
    paa: true,
    roller: ["forelder", "barn"],
    komponent: Middag,
  },
  {
    id: "meg",
    navn: "Innstillinger",
    ikon: "innstillinger",
    paa: true,
    roller: ["forelder", "barn", "besteforelder"],
    komponent: Profile,
  },
];
