/**
 * Barna kalles A, B, C i alt som sendes til KI-en. Navn i regler og svar byttes ut før de sendes,
 * så KI-en bare får vite klasse og trinn, aldri hvem barnet er.
 */
export interface Person {
  id: number;
  visningsnavn: string;
  rolle: string;
}

/** Barna sorteres på id og får A, B, C og så videre. */
export function barnAlias(barn: { id: number }[]): Map<number, string> {
  const alias = new Map<number, string>();
  [...barn]
    .sort((a, b) => a.id - b.id)
    .forEach((b, i) => alias.set(b.id, String.fromCharCode(65 + i)));
  return alias;
}

/** Småord som kan stå i et navn («Farmor og farfar»), men ikke skal byttes ut hver for seg. */
const SMAAORD = new Set([
  "og",
  "med",
  "for",
  "til",
  "den",
  "det",
  "som",
  "på",
  "av",
  "en",
  "et",
  "i",
]);

/** Navnene som skal byttes: hele navnet og hvert enkelt navn for seg, uten småord. */
function navnedeler(visningsnavn: string): string[] {
  const hele = visningsnavn.trim();
  const deler = hele.split(/\s+/).filter((d) => d.length >= 3 && !SMAAORD.has(d.toLowerCase()));
  return [hele, ...deler].filter((n) => n.length >= 2);
}

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Bytter navnene til alle brukerne i teksten: barn blir «barn A», voksne «forelder». Hele ord, uavhengig av
 * store og små bokstaver, og de lengste navnene først så «Nelly Louise» tas før «Nelly».
 */
export function anonymiserTekst(
  tekst: string,
  personer: Person[],
  alias: Map<number, string>,
): string {
  const navn = personer
    .flatMap((p) => {
      const erstatning = p.rolle === "barn" ? `barn ${alias.get(p.id) ?? "?"}` : "forelder";
      // Fullt navn, og hvert enkelt navn for seg, siden folk skriver bare fornavnet
      return navnedeler(p.visningsnavn).map((n) => ({ n, erstatning }));
    })
    .sort((a, b) => b.n.length - a.n.length);
  let ut = tekst;
  for (const { n, erstatning } of navn) {
    // «Eliass pasta» er genitiv: navnet etterfulgt av s, som blir «barn A sin pasta»
    ut = ut.replace(
      new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegex(n)}(s)?(?![\\p{L}\\p{N}])`, "giu"),
      (_hele, genitiv: string | undefined) => (genitiv ? `${erstatning} sin` : erstatning),
    );
  }
  return ut;
}

/** Sjekker at ingen navn står igjen i teksten som skal sendes. Brukes i tester og som sikkerhetsnett. */
export function inneholderNavn(tekst: string, personer: Person[]): string[] {
  return personer
    .flatMap((p) => navnedeler(p.visningsnavn))
    .filter((n) =>
      new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegex(n)}s?(?![\\p{L}\\p{N}])`, "iu").test(tekst),
    );
}

/**
 * Setter navnene tilbake i tekst fra KI-en: «barn B» blir «Nelly», og «barn A og B» blir «Elias og Nelly».
 * Bare bokstaver som hører til et barn byttes, og bare etter ordet «barn», så «gruppe B» og «3A» står urørt.
 */
export function settInnNavn(tekst: string, aliasTilBarn: Map<string, { navn: string }>): string {
  const navnFor = (bokstav: string) => aliasTilBarn.get(bokstav)?.navn;
  return tekst.replace(
    /(?<![\p{L}\p{N}])[Bb]arn ([A-Z])((?:(?:,| og) [A-Z](?![\p{L}\p{N}]))*)(?![\p{L}\p{N}])/gu,
    (hele, forste: string, resten: string) => {
      const forsteNavn = navnFor(forste);
      if (!forsteNavn) return hele;
      // Resten er bare «, X» og « og X», så hver stor bokstav der er et barn
      const rest = resten.replace(/[A-Z]/g, (b) => navnFor(b) ?? b);
      return forsteNavn + rest;
    },
  );
}
