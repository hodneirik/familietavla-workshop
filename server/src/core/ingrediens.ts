/**
 * Ingredienser skrives som en linje, helst med mengde først: «400 g kjøttdeig», «2 stk salat», «salt».
 * Her tolkes linjen, og mengder legges sammen når samme vare trengs til flere middager.
 */

export interface Ingrediens {
  /** Varen uten mengde, for eksempel «kjøttdeig». */
  navn: string;
  /** Tallet i linjen, eller null hvis det ikke står noen mengde. */
  mengde: number | null;
  /** Enheten slik den står (små bokstaver). Tom hvis det bare er et tall, som «2 egg». */
  enhet: string | null;
  /** Mengden slik den ble skrevet, med enhet («400 g»), for å bygge linjen på nytt. */
  mengdetekst: string;
}

const ENHETER = [
  "kg",
  "hg",
  "g",
  "l",
  "dl",
  "cl",
  "ml",
  "ss",
  "ts",
  "stk",
  "pk",
  "pakke",
  "pakker",
  "boks",
  "bokser",
  "bunt",
  "neve",
  "fedd",
  "skive",
  "skiver",
  "glass",
  "pose",
  "poser",
  "flaske",
  "flasker",
  "klype",
  "kvast",
  "terning",
  "terninger",
];
const ENHET_ALIAS: Record<string, string> = {
  pakke: "pk",
  pakker: "pk",
  bokser: "boks",
  skiver: "skive",
  poser: "pose",
  flasker: "flaske",
  terninger: "terning",
};
const BRUK = new RegExp(
  `^\\s*(\\d+(?:[.,]\\d+)?|\\d+\\s*/\\s*\\d+|[½¼¾])\\s*(${ENHETER.join("|")})?\\.?\\s+(\\S.*?)\\s*$`,
  "iu",
);
const BRØK: Record<string, number> = { "½": 0.5, "¼": 0.25, "¾": 0.75 };

function tilTall(t: string): number | null {
  if (t in BRØK) return BRØK[t]!;
  if (t.includes("/")) {
    const [a, b] = t.split("/").map((x) => Number(x.trim()));
    return a && b ? a / b : null;
  }
  const n = Number(t.replace(",", "."));
  return Number.isFinite(n) && n > 0 && n < 100_000 ? n : null;
}

export function parseIngrediens(linje: string): Ingrediens {
  const ren = linje.trim().replace(/\s+/g, " ");
  const m = BRUK.exec(ren);
  const mengde = m ? tilTall(m[1]!) : null;
  if (!m || mengde === null) return { navn: ren, mengde: null, enhet: null, mengdetekst: "" };
  const enhetRå = m[2]?.toLowerCase() ?? null;
  const enhet = enhetRå ? (ENHET_ALIAS[enhetRå] ?? enhetRå) : null;
  const navn = m[3]!;
  return { navn, mengde, enhet, mengdetekst: ren.slice(0, ren.length - navn.length).trim() };
}

/** Bygger linjen på nytt med et annet navn, og beholder mengden slik den ble skrevet. */
export const medNavn = (i: Ingrediens, navn: string): string =>
  i.mengdetekst ? `${i.mengdetekst} ${navn}` : navn;

// Mengder

/** Enheter som kan legges sammen: alt i vekt går til gram, og alt i volum til milliliter. */
const GRUPPER: Record<string, { gruppe: string; faktor: number }> = {
  g: { gruppe: "vekt", faktor: 1 },
  hg: { gruppe: "vekt", faktor: 100 },
  kg: { gruppe: "vekt", faktor: 1000 },
  ml: { gruppe: "volum", faktor: 1 },
  cl: { gruppe: "volum", faktor: 10 },
  dl: { gruppe: "volum", faktor: 100 },
  l: { gruppe: "volum", faktor: 1000 },
};

const tallTekst = (n: number): string =>
  (Math.round(n * 100) / 100).toLocaleString("nb-NO", { maximumFractionDigits: 2 });

/** Skriver en sum pent: 1 500 g blir «1,5 kg», 300 ml blir «3 dl», og stykker beholder enheten. */
function skrivGruppe(gruppe: string, sum: number, enhet: string): string {
  if (gruppe === "vekt") return sum >= 1000 ? `${tallTekst(sum / 1000)} kg` : `${tallTekst(sum)} g`;
  if (gruppe === "volum") {
    if (sum >= 1000) return `${tallTekst(sum / 1000)} l`;
    if (sum >= 100 && sum % 100 === 0) return `${tallTekst(sum / 100)} dl`;
    return `${tallTekst(sum)} ml`;
  }
  return enhet === "stk" ? `${tallTekst(sum)} stk` : `${tallTekst(sum)} ${enhet}`;
}

/**
 * Legger sammen mengdene til samme vare: «400 g» og «200 g» blir «600 g», «2 dl» og «5 dl» blir «7 dl»,
 * og et tall uten enhet regnes som stykker. Ulike slag (g og stk) står ved siden av hverandre. Står noe uten mengde
 * i tillegg, legges «og mer» til. Gir null hvis ingen har mengde.
 */
export function summerMengder(
  deler: { mengde: number | null; enhet: string | null }[],
): string | null {
  const summer = new Map<string, { sum: number; enhet: string; gruppe: string }>();
  let utenMengde = false;
  for (const d of deler) {
    if (d.mengde === null) {
      utenMengde = true;
      continue;
    }
    const enhet = d.enhet ?? "stk";
    const g = GRUPPER[enhet];
    const nokkel = g ? g.gruppe : `enhet:${enhet}`;
    const naa = summer.get(nokkel) ?? { sum: 0, enhet, gruppe: g ? g.gruppe : "annet" };
    naa.sum += d.mengde * (g ? g.faktor : 1);
    summer.set(nokkel, naa);
  }
  if (summer.size === 0) return null;
  const tekst = [...summer.values()].map((s) => skrivGruppe(s.gruppe, s.sum, s.enhet)).join(" + ");
  return utenMengde ? `${tekst} og mer` : tekst;
}
