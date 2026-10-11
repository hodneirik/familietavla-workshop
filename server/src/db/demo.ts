import type { AuthUser } from "../core/auth.js";
import {
  createGjoremal,
  fullforGjoremal,
  godkjennGjoremal,
  taGjoremal,
} from "../modules/gjoremal/service.js";
import { createVare } from "../modules/handleliste/service.js";
import { createHendelse, createKalender } from "../modules/kalender/service.js";
import { createLekser } from "../modules/lekser/service.js";
import { createRett } from "../modules/middag/retter.js";
import { settMiddag } from "../modules/middag/service.js";
import { createLapp } from "../modules/oppslag/service.js";
import { createUser, getUser } from "../modules/users/service.js";
import type { Db } from "./client.js";

/** Innlogging for demofamilien. Dette er oppdiktede brukere, og PIN-ene står her med vilje. */
export const DEMO_BRUKERE = [
  { visningsnavn: "Anita", rolle: "forelder", farge: "#889cb0", emoji: "🌿", pin: "1111" },
  { visningsnavn: "Elias", rolle: "barn", farge: "#82b797", emoji: "🦖", pin: "2222" },
  { visningsnavn: "Nelly", rolle: "barn", farge: "#cda89a", emoji: "🦄", pin: "3333" },
  { visningsnavn: "Farmor", rolle: "besteforelder", farge: "#e6d8b0", emoji: "🧶", pin: "4444" },
] as const;

const dato = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Dagens dato pluss `dager`, så demoen alltid ser levende ut uansett når den lastes inn. */
function om(dager: number): Date {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + dager);
  return d;
}

const tid = (dager: number, klokke: string) => `${dato(om(dager))}T${klokke}`;

function somBruker(db: Db, id: number): AuthUser {
  const u = getUser(db, id);
  return { id: u.id, visningsnavn: u.visningsnavn, rolle: u.rolle, farge: u.farge, emoji: u.emoji };
}

/** Fyller en tom database med en oppdiktet familie og eksempeldata for alle fanene. */
export function seedDemo(db: Db, naa = Date.now()): void {
  const finnes = db.prepare("SELECT COUNT(*) AS n FROM users").get() as { n: number };
  if (finnes.n > 0) {
    throw new Error(
      "Databasen har allerede brukere. Slett mappen server/data for å starte på nytt.",
    );
  }

  const [anita, elias, nelly, farmor] = DEMO_BRUKERE.map((b) =>
    somBruker(db, createUser(db, b, null).id),
  ) as [AuthUser, AuthUser, AuthUser, AuthUser];

  // Kalender
  const familie = createKalender(db, anita, { navn: "Familien", farge: "#889cb0" });
  const fotball = createKalender(db, anita, { navn: "Fotball", farge: "#82b797" });
  const dagIdag = om(0).getDay();
  const tilOnsdag = (3 - dagIdag + 7) % 7;
  createHendelse(db, anita, {
    kalenderId: fotball.id,
    tittel: "Fotballtrening",
    sted: "Kunstgressbanen",
    helDag: false,
    start: tid(tilOnsdag, "17:30"),
    slutt: tid(tilOnsdag, "19:00"),
    gjentas: "ukentlig",
    gjentasTil: dato(om(120)),
  });
  createHendelse(db, anita, {
    kalenderId: familie.id,
    tittel: "Tannlege for Nelly",
    sted: "Tannklinikken",
    helDag: false,
    start: tid(2, "14:15"),
  });
  createHendelse(db, anita, {
    kalenderId: familie.id,
    tittel: "Foreldremøte",
    sted: "Skolen",
    helDag: false,
    start: tid(5, "18:00"),
    slutt: tid(5, "19:30"),
  });
  createHendelse(db, anita, {
    kalenderId: familie.id,
    tittel: "Farmor har bursdag",
    helDag: true,
    start: dato(om(9)),
  });

  // Retter og middag
  const retter = [
    ["Taco", ["Tortillalefser", "Kjøttdeig", "Tacokrydder", "Salat", "Mais"]],
    ["Lasagne", ["Lasagneplater", "Kjøttdeig", "Tomatsaus", "Ost"]],
    ["Fiskesuppe", ["Torsk", "Gulrot", "Fløte", "Purre"]],
    ["Pannekaker", ["Mel", "Egg", "Melk", "Syltetøy"]],
    ["Pasta med pesto", ["Pasta", "Pesto", "Parmesan"]],
  ] as const;
  const retterId = retter.map(
    ([tittel, ingredienser]) =>
      createRett(db, anita, { tittel, ingredienser: [...ingredienser] }).id,
  );
  for (let dag = 0; dag < 14; dag++) {
    settMiddag(db, anita, dato(om(dag)), retterId[dag % retterId.length]!);
  }

  // Handleliste
  for (const vare of ["Melk", "Brød", "Epler", "Smør"]) createVare(db, anita, vare);
  createVare(db, nelly, "Yoghurt", "Den med jordbær");

  // Gjøremål, og ett som ligger til godkjenning så flyten kan prøves
  const oppvask = createGjoremal(db, anita, {
    tittel: "Tømme oppvaskmaskinen",
    poeng: 5,
    gjentas: "daglig",
  });
  createGjoremal(db, anita, { tittel: "Rydde rommet", poeng: 10, gjentas: "ukentlig" });
  createGjoremal(db, farmor, { tittel: "Skrive et postkort til Farmor", poeng: 20 });
  const ferdig = createGjoremal(db, anita, { tittel: "Vanne blomstene", poeng: 5 });
  taGjoremal(db, elias, ferdig.id, naa);
  fullforGjoremal(db, elias, ferdig.id);
  const godkjent = createGjoremal(db, anita, { tittel: "Ta ut søpla", poeng: 5 });
  taGjoremal(db, nelly, godkjent.id, naa);
  fullforGjoremal(db, nelly, godkjent.id);
  godkjennGjoremal(db, anita, godkjent.id, naa);
  void oppvask;

  // Lekser
  createLekser(db, anita, {
    barnIder: [elias.id],
    tittel: "Les side 24 til 27",
    fag: "Norsk",
    frist: dato(om(2)),
  });
  createLekser(db, anita, {
    barnIder: [elias.id, nelly.id],
    tittel: "Øv på gangetabellen",
    fag: "Matte",
    frist: dato(om(4)),
  });
  createLekser(db, anita, {
    barnIder: [nelly.id],
    tittel: "Tegn et dyr fra naturen",
    fag: "Kunst",
    frist: dato(om(6)),
  });

  // Oppslagstavle
  createLapp(db, anita, { tekst: "Husk gymtøy på onsdag!", farge: "gul" });
  createLapp(db, elias, { tekst: "Hvem vil spille fotball i helgen?", farge: "grønn" });
  createLapp(db, farmor, { tekst: "Jeg bakte boller. Kom og hent!", farge: "rosa" });
}
