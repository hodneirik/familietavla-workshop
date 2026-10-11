/** Det serveren svarer med når KI-en lager retter. Speiler server/src/modules/ki/retter.ts. */
export interface RettForslagSvar {
  forslagId: string;
  tittel: string;
  notat: string | null;
  ingredienser: string[];
}

export interface RetterForslagSvar {
  sammendrag: string;
  retter: RettForslagSvar[];
  advarsler: string[];
  forkastet: number;
}

export interface RetterResultat {
  forslag: RetterForslagSvar;
  kostnad_ore: number;
  brukt_ore: number;
  tak_ore: number;
}

export interface RetterLeggInnSvar {
  rader: { forslagId: string; ok: boolean; feil?: string }[];
  antallOk: number;
}

export const ANTALL_VALG = [3, 5, 8, 10];

/** Hva forelderen kan rette i en foreslått rett før den legges til. */
export interface RettRedigert {
  forslagId: string;
  valgt: boolean;
  tittel: string;
  notat: string;
  /** Én ingrediens per linje. */
  ingredienser: string;
}

export const lagRetterState = (f: RetterForslagSvar): RettRedigert[] =>
  f.retter.map((r) => ({
    forslagId: r.forslagId,
    valgt: true,
    tittel: r.tittel,
    notat: r.notat ?? "",
    ingredienser: r.ingredienser.join("\n"),
  }));

export const antallValgtRetter = (r: RettRedigert[]): number => r.filter((x) => x.valgt).length;

/** En rett er klar når den har et navn. */
export const erRettKlar = (r: RettRedigert): boolean => r.tittel.trim() !== "";

export const lagRetterBody = (retter: RettRedigert[]) => ({
  retter: retter
    .filter((r) => r.valgt)
    .map((r) => ({
      forslagId: r.forslagId,
      tittel: r.tittel.trim(),
      notat: r.notat.trim() || null,
      ingredienser: r.ingredienser
        .split("\n")
        .map((i) => i.trim())
        .filter(Boolean),
    })),
});
