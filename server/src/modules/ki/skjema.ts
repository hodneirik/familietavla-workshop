import { z } from "zod";
import { LAPPFARGER } from "../oppslag/service.js";

/** Ukedagene slik KI-en skriver dem. Plassen i lista er ukedagsnummeret (0 = mandag). */
export const UKEDAGER_KI = [
  "mandag",
  "tirsdag",
  "onsdag",
  "torsdag",
  "fredag",
  "lørdag",
  "søndag",
] as const;

/**
 * Det modellen får lov å svare. Ingen min/max her: strukturerte svar støtter ikke slike grenser, så de
 * håndheves i validering.ts. Barn heter A, B, C og kalendere K1, K2, aldri id-er eller navn.
 */
export const KiUkeplanSvar = z.object({
  ukeStart: z.string().nullable().describe("Mandagen i uka planen gjelder, ÅÅÅÅ-MM-DD, eller null"),
  sammendrag: z.string().describe("Høyst to setninger om hva uka handler om"),
  lekser: z.array(
    z.object({
      barn: z.array(z.string()).describe('Barnas aliaser, for eksempel ["A"]'),
      fag: z.string().nullable(),
      tittel: z.string().describe("Kort, for eksempel «Les side 40 til 45»"),
      fritekst: z.string().nullable().describe("Mer om oppgaven, hvis planen sier noe mer"),
      frist: z.string().describe("Dagen leksa skal være gjort, ÅÅÅÅ-MM-DD"),
      usikker: z.boolean(),
    }),
  ),
  avtaler: z.array(
    z.object({
      tittel: z.string(),
      dato: z.string().describe("ÅÅÅÅ-MM-DD"),
      helDag: z.boolean(),
      start: z.string().nullable().describe("TT:MM, eller null for hel dag"),
      slutt: z.string().nullable().describe("TT:MM, eller null"),
      sted: z.string().nullable(),
      barn: z.array(z.string()),
      kalender: z.string().nullable().describe("Kalenderens alias, for eksempel K1"),
      gjentasUkentlig: z.boolean(),
      usikker: z.boolean(),
    }),
  ),
  paaminnelser: z
    .array(
      z.object({
        tittel: z.string().describe("Kort, for eksempel «Gym», «Bibliotek» eller «Turdag»"),
        ukedag: z
          .enum(UKEDAGER_KI)
          .nullable()
          .describe("Ukedagen hvis det gjentas hver uke, ellers null"),
        dato: z
          .string()
          .nullable()
          .describe(
            "ÅÅÅÅ-MM-DD hvis det bare gjelder én bestemt dag (for eksempel turdag), ellers null",
          ),
        fra: z
          .string()
          .nullable()
          .describe("ÅÅÅÅ-MM-DD, første dag hvis det gjentas bare i en periode, ellers null"),
        til: z
          .string()
          .nullable()
          .describe("ÅÅÅÅ-MM-DD, siste dag hvis det gjentas bare i en periode, ellers null"),
        barn: z.array(z.string()).describe('Barnas aliaser, for eksempel ["A"]'),
        usikker: z.boolean(),
      }),
    )
    .describe("Ting barna skal huske: faste hver uke, bare en periode, eller én bestemt dag"),
  lapper: z.array(
    z.object({
      tekst: z.string().describe("Høyst 280 tegn"),
      farge: z.enum(LAPPFARGER),
    }),
  ),
  annet: z.array(z.object({ tittel: z.string(), tekst: z.string() })),
  spoersmaal: z.array(
    z.object({
      id: z.string(),
      tekst: z.string(),
      valg: z.array(z.object({ id: z.string(), tekst: z.string() })),
    }),
  ),
  advarsler: z.array(z.string()),
});
export type KiUkeplanSvarType = z.infer<typeof KiUkeplanSvar>;

/** JSON-skjemaet som sendes til Claude. Strukturerte svar vil ha `anyOf` med null i stedet for typelister. */
export function jsonSkjema(skjema: z.ZodType): Record<string, unknown> {
  const rå = z.toJSONSchema(skjema) as Record<string, unknown>;
  const rens = (node: unknown): unknown => {
    if (Array.isArray(node)) return node.map(rens);
    if (node && typeof node === "object") {
      const ut: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
        if (k === "$schema") continue;
        ut[k] = rens(v);
      }
      if (Array.isArray(ut.type) && ut.type.length === 2 && ut.type.includes("null")) {
        const hoved = ut.type.find((t) => t !== "null");
        delete ut.type;
        ut.anyOf = [{ type: hoved, ...(ut.enum ? { enum: ut.enum } : {}) }, { type: "null" }];
        delete ut.enum;
      }
      return ut;
    }
    return node;
  };
  return rens(rå) as Record<string, unknown>;
}

// Det som sendes til nettleseren etter at serveren har validert svaret

export interface LeksForslag {
  forslagId: string;
  barnIder: number[];
  barnNavn: string[];
  fag: string | null;
  tittel: string;
  fritekst: string | null;
  frist: string;
  usikker: boolean;
}

export interface AvtaleForslag {
  forslagId: string;
  kalenderId: number | null;
  tittel: string;
  sted: string | null;
  helDag: boolean;
  start: string;
  slutt: string | null;
  gjentasUkentlig: boolean;
  barnNavn: string[];
  usikker: boolean;
}

export interface PaaminnelseForslag {
  forslagId: string;
  barnIder: number[];
  barnNavn: string[];
  tittel: string;
  /** 0 = mandag, 6 = søndag. Tom for en enkeltdag. */
  ukedag: number | null;
  /** Enkeltdagen (ÅÅÅÅ-MM-DD). Tom for en fast ukedag. */
  dato: string | null;
  fra: string | null;
  til: string | null;
  usikker: boolean;
}

export interface LappForslag {
  forslagId: string;
  tekst: string;
  farge: (typeof LAPPFARGER)[number];
}

export interface AnnetForslag {
  tittel: string;
  tekst: string;
}

export interface Sporsmaal {
  id: string;
  tekst: string;
  valg: { id: string; tekst: string }[];
}

export interface ValidertForslag {
  ukeStart: string;
  sammendrag: string;
  lekser: LeksForslag[];
  avtaler: AvtaleForslag[];
  paaminnelser: PaaminnelseForslag[];
  lapper: LappForslag[];
  annet: AnnetForslag[];
  spoersmaal: Sporsmaal[];
  advarsler: string[];
  /** Hvor mange elementer serveren forkastet fordi de var ugyldige. */
  forkastet: number;
}
