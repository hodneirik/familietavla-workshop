import { apiGet } from "../../lib/api";

const POLL_MS = 2000;
const GI_OPP_MS = 3 * 60_000;

type JobbSvar<T> =
  { status: "venter" } | { status: "feil"; melding: string } | { status: "ferdig"; resultat: T };

/**
 * Venter på en KI-jobb som kjører i bakgrunnen på serveren, og spør hvert andre sekund. Gir null hvis
 * siden er forlatt i mellomtiden (`levende` gir false). Kaster med en trygg melding hvis jobben feilet.
 */
export async function ventPaaJobb<T>(jobbId: string, levende: () => boolean): Promise<T | null> {
  const slutt = Date.now() + GI_OPP_MS;
  while (Date.now() < slutt) {
    await new Promise((r) => setTimeout(r, POLL_MS));
    if (!levende()) return null;
    const j = await apiGet<JobbSvar<T>>(`/api/ki/jobber/${jobbId}`);
    if (j.status === "feil") throw new Error(j.melding);
    if (j.status === "ferdig") return j.resultat;
  }
  throw new Error("KI-en brukte for lang tid. Prøv igjen.");
}
