import type { Lekse } from "../../lib/types";

/**
 * Leksene sorteres alltid etter barn: barna i alfabetisk rekkefølge, og for hvert barn de eldste
 * fristene først. Samme rekkefølge hver gang, så et barns lekser står samlet.
 */
export function sorterEtterBarn(lekser: Lekse[]): Lekse[] {
  return [...lekser].sort(
    (a, b) =>
      a.barn.visningsnavn.localeCompare(b.barn.visningsnavn, "nb") ||
      a.barn.id - b.barn.id ||
      a.frist.localeCompare(b.frist) ||
      a.id - b.id,
  );
}
