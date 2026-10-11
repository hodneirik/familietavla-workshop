import { HttpError } from "../../core/errors.js";

/** Analysen tar 20 til 90 sekunder, for lenge for én HTTP-forespørsel via tunnelen, så den kjører som en jobb. */
export type JobbStatus<T> =
  { status: "venter" } | { status: "feil"; melding: string } | { status: "ferdig"; resultat: T };

interface Jobb<T> {
  brukerId: number;
  opprettet: number;
  tilstand: JobbStatus<T>;
}

const LEVETID_MS = 30 * 60_000;
const MAKS_PER_BRUKER = 1;
const MAKS_TOTALT = 2;

/** Jobbene ligger i minnet. En omstart midt i en analyse mister jobben, og forelderen prøver på nytt. */
export function lagJobbregister<T>(naa: () => number) {
  const jobber = new Map<string, Jobb<T>>();
  let teller = 0;

  const rydd = () => {
    const grense = naa() - LEVETID_MS;
    for (const [id, j] of jobber) if (j.opprettet < grense) jobber.delete(id);
  };
  const aktive = (brukerId?: number) =>
    [...jobber.values()].filter(
      (j) => j.tilstand.status === "venter" && (brukerId === undefined || j.brukerId === brukerId),
    ).length;

  return {
    /** Starter en jobb, eller avviser hvis brukeren allerede har en som kjører, eller serveren er travel. */
    start(brukerId: number, kjor: () => Promise<T>, feilmelding: (err: unknown) => string): string {
      rydd();
      if (aktive(brukerId) >= MAKS_PER_BRUKER) {
        throw new HttpError(429, "Vent til forrige analyse er ferdig.");
      }
      if (aktive() >= MAKS_TOTALT) {
        throw new HttpError(429, "KI-en er opptatt med andre analyser. Prøv igjen om litt.");
      }
      const id = `j${naa().toString(36)}${(teller++).toString(36)}${Math.random().toString(36).slice(2, 8)}`;
      const jobb: Jobb<T> = { brukerId, opprettet: naa(), tilstand: { status: "venter" } };
      jobber.set(id, jobb);
      kjor().then(
        (resultat) => {
          jobb.tilstand = { status: "ferdig", resultat };
        },
        (err: unknown) => {
          jobb.tilstand = { status: "feil", melding: feilmelding(err) };
        },
      );
      return id;
    },
    /** Bare den som startet jobben, får se den. */
    hent(id: string, brukerId: number): JobbStatus<T> {
      rydd();
      const jobb = jobber.get(id);
      if (!jobb || jobb.brukerId !== brukerId) throw new HttpError(404, "Fant ikke analysen");
      return jobb.tilstand;
    },
    antallAktive: aktive,
  };
}
