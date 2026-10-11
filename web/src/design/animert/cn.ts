/** Slår sammen klassenavn og hopper over tomme. */
export function cn(...klasser: (string | undefined | false | null)[]): string {
  return klasser.filter(Boolean).join(" ");
}
