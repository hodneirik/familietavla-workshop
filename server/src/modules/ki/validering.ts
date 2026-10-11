import { erDato, leggTilDager } from "../../core/dato.js";
import { hendelse } from "../kalender/routes.js";
import { settInnNavn } from "./anonymiser.js";
import { nyLekse } from "../lekser/routes.js";
import { nyLapp } from "../oppslag/routes.js";
import { nyPaaminnelse } from "../paaminnelser/routes.js";
import { UKEDAGER_KI } from "./skjema.js";
import type {
  AnnetForslag,
  AvtaleForslag,
  KiUkeplanSvarType,
  LappForslag,
  LeksForslag,
  PaaminnelseForslag,
  Sporsmaal,
  ValidertForslag,
} from "./skjema.js";

export const MAKS = {
  lekser: 30,
  avtaler: 40,
  paaminnelser: 20,
  lapper: 8,
  annet: 10,
  spoersmaal: 4,
  advarsler: 5,
};

// eslint-disable-next-line no-control-regex -- kontrolltegn skal fjernes
const KONTROLLTEGN = /[\u0000-\u0008\u000b-\u001f\u007f]/g;
const LENKE = /(https?:\/\/|www\.|ftp:|mailto:|@|\b[a-z0-9-]+\.(no|com|org|net|io|me|ly)\b)/i;
const TID = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Teksten er trygg å vise: ingen kontrolltegn, ingen lenker eller e-postadresser. */
export const harLenke = (s: string) => LENKE.test(s);

/** Renser og kutter teksten. Gir null hvis den er tom eller inneholder en lenke. */
export function renTekst(s: string | null | undefined, maks: number): string | null {
  if (s === null || s === undefined) return null;
  const ren = s
    .replace(KONTROLLTEGN, " ")
    .replace(/[ \t]+/g, " ")
    .trim()
    .slice(0, maks)
    .trim();
  if (!ren || harLenke(ren)) return null;
  return ren;
}

/** Alle datoer må ligge rundt uka planen gjelder: to uker før til to uker etter. */
export function innenVindu(dato: string, ukeStart: string): boolean {
  return erDato(dato) && dato >= leggTilDager(ukeStart, -14) && dato <= leggTilDager(ukeStart, 20);
}

/** En periode (svømming noen uker) kan vare lenger enn uka planen gjelder, men ikke mer enn fire måneder frem. */
export function innenPeriode(dato: string, ukeStart: string): boolean {
  return erDato(dato) && dato >= leggTilDager(ukeStart, -14) && dato <= leggTilDager(ukeStart, 120);
}

export interface ValideringsKontekst {
  ukeStart: string;
  idag: string;
  /** A, B, C → barn */
  aliasTilBarn: Map<string, { id: number; navn: string }>;
  /** K1, K2 → kalender-id (bare kalendere som kan skrives til) */
  kalenderAlias: Map<string, number>;
  standardKalenderId: number | null;
  /** Påminnelser som finnes fra før, som «barnId|ukedag|dato|fra|til|tittel» (tittelen med små bokstaver). De foreslås ikke på nytt. */
  eksisterendePaaminnelser?: Set<string>;
}

/** «Hopp over» legger appen til selv, så KI-ens egne varianter tas bort. */
const HOPP_OVER = /^(hopp over|hopper over|hopp over dette)\.?$/i;

export function validerSvar(rå0: KiUkeplanSvarType, k: ValideringsKontekst): ValidertForslag {
  // KI-en kaller barna «barn A» og «barn B». I tekst som vises settes navnene inn igjen her.
  const rå = medNavn(rå0, k);
  let forkastet = 0;
  const advarsler: string[] = [];
  const sett = new Set<string>();
  const unik = (nokkel: unknown) => {
    const n = JSON.stringify(nokkel);
    if (sett.has(n)) return false;
    sett.add(n);
    return true;
  };

  const barnFra = (alias: string[]) => {
    const funnet = alias
      .map((a) => k.aliasTilBarn.get(a.trim().toUpperCase()))
      .filter((b): b is { id: number; navn: string } => !!b);
    return [...new Map(funnet.map((b) => [b.id, b])).values()];
  };

  const lekser: LeksForslag[] = [];
  for (const l of rå.lekser) {
    if (lekser.length >= MAKS.lekser) {
      forkastet++;
      continue;
    }
    const barn = barnFra(l.barn);
    const tittel = renTekst(l.tittel, 120);
    const fag = renTekst(l.fag, 40);
    const fritekst = renTekst(l.fritekst, 1000);
    const gyldig =
      barn.length > 0 &&
      tittel &&
      innenVindu(l.frist, k.ukeStart) &&
      l.frist >= k.idag &&
      nyLekse.safeParse({ barnIder: barn.map((b) => b.id), tittel, fag, fritekst, frist: l.frist })
        .success;
    if (!gyldig || !tittel || !unik(["l", barn.map((b) => b.id), fag, tittel, l.frist])) {
      forkastet++;
      continue;
    }
    lekser.push({
      forslagId: `l${lekser.length + 1}`,
      barnIder: barn.map((b) => b.id),
      barnNavn: barn.map((b) => b.navn),
      fag,
      tittel,
      fritekst,
      frist: l.frist,
      usikker: l.usikker,
    });
  }

  const avtaler: AvtaleForslag[] = [];
  for (const a of rå.avtaler) {
    if (avtaler.length >= MAKS.avtaler) {
      forkastet++;
      continue;
    }
    const tittel = renTekst(a.tittel, 80);
    const sted = renTekst(a.sted, 80);
    if (!tittel || !innenVindu(a.dato, k.ukeStart) || a.dato < k.idag) {
      forkastet++;
      continue;
    }
    let usikker = a.usikker;
    // Uten gyldig klokkeslett blir det en hel dag, og forelderen ser at det er usikkert
    const tidsavtale = !a.helDag && a.start !== null && TID.test(a.start);
    if (!a.helDag && !tidsavtale) usikker = true;
    const start = tidsavtale ? `${a.dato}T${a.start}` : a.dato;
    const slutt =
      tidsavtale && a.slutt !== null && TID.test(a.slutt) && `${a.dato}T${a.slutt}` > start
        ? `${a.dato}T${a.slutt}`
        : null;
    const kalenderId =
      (a.kalender ? k.kalenderAlias.get(a.kalender.trim().toUpperCase()) : undefined) ??
      k.standardKalenderId;
    if (
      !unik(["a", tittel, start, slutt]) ||
      !hendelse.safeParse({
        kalenderId: kalenderId ?? 1,
        tittel,
        sted,
        helDag: !tidsavtale,
        start,
        slutt,
      }).success
    ) {
      forkastet++;
      continue;
    }
    avtaler.push({
      forslagId: `a${avtaler.length + 1}`,
      kalenderId: kalenderId ?? null,
      tittel,
      sted,
      helDag: !tidsavtale,
      start,
      slutt,
      gjentasUkentlig: a.gjentasUkentlig,
      barnNavn: barnFra(a.barn).map((b) => b.navn),
      usikker,
    });
  }

  const paaminnelser: PaaminnelseForslag[] = [];
  for (const p of rå.paaminnelser) {
    const barn = barnFra(p.barn);
    const tittel = renTekst(p.tittel, 60);
    const ukedag = p.ukedag === null ? null : UKEDAGER_KI.indexOf(p.ukedag);
    const enkeltdag = p.dato !== null && p.dato !== "";
    const fra = enkeltdag ? null : p.fra || null;
    const til = enkeltdag ? null : p.til || null;
    const gyldigTid = enkeltdag
      ? innenVindu(p.dato!, k.ukeStart) && p.dato! >= k.idag
      : ukedag !== null &&
        ukedag >= 0 &&
        (fra === null || innenVindu(fra, k.ukeStart)) &&
        (til === null || (innenPeriode(til, k.ukeStart) && til >= k.idag)) &&
        (fra === null || til === null || fra <= til);
    if (
      paaminnelser.length >= MAKS.paaminnelser ||
      !tittel ||
      barn.length === 0 ||
      !gyldigTid ||
      !nyPaaminnelse.safeParse({
        barnIder: barn.map((b) => b.id),
        tittel,
        ...(enkeltdag ? { dato: p.dato } : { ukedager: [ukedag], fra, til }),
      }).success
    ) {
      forkastet++;
      continue;
    }
    const dato = enkeltdag ? p.dato! : null;
    // Det som finnes fra før foreslås ikke på nytt, og bare nye barn blir med
    const nokkel = (barnId: number) =>
      `${barnId}|${ukedag ?? ""}|${dato ?? ""}|${fra ?? ""}|${til ?? ""}|${tittel.toLowerCase()}`;
    const nye = barn.filter((b) => !k.eksisterendePaaminnelser?.has(nokkel(b.id)));
    if (nye.length === 0 || !unik(["r", nye.map((b) => b.id), nokkel(0)])) continue;
    paaminnelser.push({
      forslagId: `r${paaminnelser.length + 1}`,
      barnIder: nye.map((b) => b.id),
      barnNavn: nye.map((b) => b.navn),
      tittel,
      ukedag,
      dato,
      fra,
      til,
      usikker: p.usikker,
    });
  }

  const lapper: LappForslag[] = [];
  for (const l of rå.lapper) {
    const tekst = renTekst(l.tekst, 280);
    if (
      lapper.length >= MAKS.lapper ||
      !tekst ||
      !unik(["p", tekst]) ||
      !nyLapp.safeParse({ tekst, farge: l.farge }).success
    ) {
      forkastet++;
      continue;
    }
    lapper.push({ forslagId: `p${lapper.length + 1}`, tekst, farge: l.farge });
  }

  const annet: AnnetForslag[] = [];
  for (const a of rå.annet) {
    const tittel = renTekst(a.tittel, 80);
    const tekst = renTekst(a.tekst, 300);
    if (annet.length >= MAKS.annet || !tittel || !tekst) {
      forkastet++;
      continue;
    }
    annet.push({ tittel, tekst });
  }

  const spoersmaal: Sporsmaal[] = [];
  for (const s of rå.spoersmaal) {
    const id = renTekst(s.id, 40);
    const tekst = renTekst(s.tekst, 200);
    const valg = s.valg
      .slice(0, 6)
      .map((v) => ({ id: renTekst(v.id, 40), tekst: renTekst(v.tekst, 80) }))
      .filter((v): v is { id: string; tekst: string } => !!v.id && !!v.tekst)
      .filter((v) => !HOPP_OVER.test(v.tekst.trim()))
      .filter(
        (v, i, alle) =>
          alle.findIndex((a) => a.tekst.toLowerCase() === v.tekst.toLowerCase()) === i,
      )
      .slice(0, 5);
    if (spoersmaal.length >= MAKS.spoersmaal || !id || !tekst || valg.length < 2) continue;
    spoersmaal.push({ id, tekst, valg });
  }

  for (const a of rå.advarsler) {
    const ren = renTekst(a, 200);
    if (ren && advarsler.length < MAKS.advarsler) advarsler.push(ren);
  }
  if (rå.ukeStart && erDato(rå.ukeStart) && rå.ukeStart !== k.ukeStart) {
    advarsler.push(
      `KI-en tror planen gjelder uka som starter ${rå.ukeStart}, ikke ${k.ukeStart}. Kontroller datoene.`,
    );
  }

  return {
    ukeStart: k.ukeStart,
    sammendrag: renTekst(rå.sammendrag, 300) ?? "",
    lekser,
    avtaler,
    paaminnelser,
    lapper,
    annet,
    spoersmaal,
    advarsler,
    forkastet,
  };
}

/** Setter navnene inn i all tekst KI-en har skrevet, før teksten renses og kuttes til riktig lengde. */
function medNavn(rå: KiUkeplanSvarType, k: ValideringsKontekst): KiUkeplanSvarType {
  const n = (t: string) => settInnNavn(t, k.aliasTilBarn);
  const nn = (t: string | null) => (t === null ? null : n(t));
  return {
    ...rå,
    sammendrag: n(rå.sammendrag),
    lekser: rå.lekser.map((l) => ({
      ...l,
      fag: nn(l.fag),
      tittel: n(l.tittel),
      fritekst: nn(l.fritekst),
    })),
    avtaler: rå.avtaler.map((a) => ({ ...a, tittel: n(a.tittel), sted: nn(a.sted) })),
    paaminnelser: rå.paaminnelser.map((p) => ({ ...p, tittel: n(p.tittel) })),
    lapper: rå.lapper.map((l) => ({ ...l, tekst: n(l.tekst) })),
    annet: rå.annet.map((a) => ({ tittel: n(a.tittel), tekst: n(a.tekst) })),
    spoersmaal: rå.spoersmaal.map((s) => ({
      ...s,
      tekst: n(s.tekst),
      valg: s.valg.map((v) => ({ ...v, tekst: n(v.tekst) })),
    })),
    advarsler: rå.advarsler.map(n),
  };
}
