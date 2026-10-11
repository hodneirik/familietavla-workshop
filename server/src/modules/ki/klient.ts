import Anthropic from "@anthropic-ai/sdk";
import type { Logger } from "../../core/logger.js";
import type { Forbruk } from "./kostnad.js";

/** Det serveren ber KI-en om. Adapteren under er det eneste stedet som kjenner SDK-en. */
export interface KiForesporsel {
  modell: string;
  system: string;
  /** Dokumentet KI-en leser. Mangler for oppgaver uten PDF, som middagsforslag. */
  pdfBase64?: string;
  /** Teksten som kommer etter dokumentet: dato, barn, kalendere, regler og svar. */
  kontekst: string;
  jsonSkjema: Record<string, unknown>;
  effort: "low" | "medium" | "high";
  fallback: boolean;
}

export interface KiResultat {
  /** Svarteksten (JSON), eller null hvis KI-en ikke ga noe. */
  tekst: string | null;
  stopReason: string | null;
  forbruk: Forbruk;
  requestId: string | null;
  modell: string;
}

export interface KiKlient {
  kjor(foresporsel: KiForesporsel): Promise<KiResultat>;
}

export type KiFeilKode =
  "opptatt" | "autentisering" | "ugyldig_foresporsel" | "tilkobling" | "annet";

/** En feil som er trygg å vise brukeren: ingen deler av svaret fra Anthropic, headers eller nøkkel. */
export class KiFeil extends Error {
  constructor(
    public kode: KiFeilKode,
    public status: number,
    melding: string,
  ) {
    super(melding);
  }
}

interface Iterasjon {
  input_tokens?: number | null;
  output_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
  cache_read_input_tokens?: number | null;
}

interface Bruk extends Iterasjon {
  iterations?: Iterasjon[] | null;
}

/** Summerer forbruket. Etter en fallback dekker `iterations` alle forsøkene, ikke bare det som ga svaret. */
export function forbrukFra(usage: Bruk | undefined): Forbruk {
  const deler: Iterasjon[] =
    usage?.iterations && usage.iterations.length > 1 ? usage.iterations : usage ? [usage] : [];
  const sum = (f: (d: Iterasjon) => number | null | undefined) =>
    deler.reduce((s, d) => s + (f(d) ?? 0), 0);
  return {
    inputTokens: sum((d) => d.input_tokens),
    cacheSkrivTokens: sum((d) => d.cache_creation_input_tokens),
    cacheLesTokens: sum((d) => d.cache_read_input_tokens),
    outputTokens: sum((d) => d.output_tokens),
  };
}

interface Valg {
  apiKey: string;
  fetch?: typeof fetch;
  timeoutMs: number;
  log: Logger;
}

export function lagAnthropicKlient({ apiKey, fetch: fetchFn, timeoutMs, log }: Valg): KiKlient {
  const klient = new Anthropic({
    apiKey,
    maxRetries: 1,
    timeout: timeoutMs,
    ...(fetchFn ? { fetch: fetchFn } : {}),
  });

  return {
    async kjor(f) {
      const innhold = [
        ...(f.pdfBase64
          ? [
              {
                type: "document" as const,
                source: {
                  type: "base64" as const,
                  media_type: "application/pdf" as const,
                  data: f.pdfBase64,
                },
                // Prefikset (systemprompt og PDF) caches, så runde to med svar fra forelderen blir billig
                cache_control: { type: "ephemeral" as const },
              },
            ]
          : []),
        { type: "text" as const, text: f.kontekst },
      ];
      const felles = {
        model: f.modell,
        max_tokens: 16000,
        system: f.system,
        messages: [{ role: "user" as const, content: innhold }],
        output_config: {
          effort: f.effort,
          format: { type: "json_schema" as const, schema: f.jsonSkjema },
        },
      };
      try {
        const svar = f.fallback
          ? await klient.beta.messages.create({
              ...felles,
              betas: ["server-side-fallback-2026-07-01"],
              fallbacks: "default",
            })
          : await klient.messages.create(felles);
        const tekst = svar.content
          .filter((b) => b.type === "text")
          .map((b) => (b as { text: string }).text)
          .join("");
        return {
          tekst: tekst || null,
          stopReason: svar.stop_reason ?? null,
          forbruk: forbrukFra(svar.usage as Bruk),
          requestId: svar._request_id ?? null,
          modell: svar.model,
        };
      } catch (err) {
        throw tilKiFeil(err, log);
      }
    },
  };
}

/** Mapper feil fra SDK-en til en trygg feil. Logger bare status og forespørsels-id, aldri innhold eller headers. */
export function tilKiFeil(err: unknown, log: Logger): KiFeil {
  if (err instanceof KiFeil) return err;
  if (err instanceof Anthropic.RateLimitError) {
    log.warn("KI: rate limit hos Anthropic", { status: err.status, requestId: err.requestID });
    return new KiFeil("opptatt", 503, "KI er opptatt akkurat nå. Prøv igjen om litt.");
  }
  if (
    err instanceof Anthropic.AuthenticationError ||
    err instanceof Anthropic.PermissionDeniedError
  ) {
    log.error("KI: nøkkelen ble avvist av Anthropic", {
      status: err.status,
      requestId: err.requestID,
    });
    return new KiFeil(
      "autentisering",
      503,
      "KI er ikke satt opp riktig. Si fra til den som drifter appen.",
    );
  }
  if (
    err instanceof Anthropic.BadRequestError ||
    err instanceof Anthropic.UnprocessableEntityError
  ) {
    log.warn("KI: forespørselen ble avvist", { status: err.status, requestId: err.requestID });
    return new KiFeil("ugyldig_foresporsel", 422, "PDF-en kunne ikke leses av KI-en.");
  }
  if (err instanceof Anthropic.APIConnectionError) {
    log.warn("KI: fikk ikke kontakt med Anthropic", {
      timeout: err instanceof Anthropic.APIConnectionTimeoutError,
    });
    return new KiFeil("tilkobling", 503, "Fikk ikke kontakt med KI-en. Prøv igjen om litt.");
  }
  if (err instanceof Anthropic.APIError) {
    log.warn("KI: feil fra Anthropic", { status: err.status, requestId: err.requestID });
    return new KiFeil("annet", 503, "KI-en svarte med en feil. Prøv igjen om litt.");
  }
  log.error("KI: uventet feil", { feil: err instanceof Error ? err.message : "ukjent" });
  return new KiFeil("annet", 503, "Noe gikk galt med KI-en.");
}
