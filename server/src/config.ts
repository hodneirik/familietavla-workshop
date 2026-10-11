import { z } from "zod";

/** En tom streng fra compose (`KEY=`) skal bety «ikke satt», ikke 0 eller tom tekst. */
const utenTomt = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);

const schema = z.object({
  SESSION_SECRET: z.string().min(32, "SESSION_SECRET må være minst 32 tegn (openssl rand -hex 32)"),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  DATA_DIR: z.string().default("./data"),
  // auto: Secure-cookie bare når forespørselen kom over https (bak en proxy), så http lokalt virker også
  COOKIE_SECURE: z.enum(["true", "false", "auto"]).default("false"),
  TRUST_PROXY: z.coerce.number().int().min(0).default(0),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  WEB_DIR: z.string().optional(),
  // Værvarselet over oppslagstavla. Standard er Oslo sentrum.
  VAER_AKTIV: z.enum(["true", "false"]).default("true"),
  VAER_STED: z.string().trim().min(1).max(60).default("Oslo"),
  VAER_LAT: z.coerce.number().min(-90).max(90).default(59.9139),
  VAER_LON: z.coerce.number().min(-180).max(180).default(10.7522),
  // KI i appen (bare for foreldre). Den er av så lenge nøkkelen mangler. Nøkkelen skal bare ligge i .env, aldri i git.
  KI_AKTIV: z.enum(["true", "false"]).default("true"),
  ANTHROPIC_API_KEY: z.preprocess(utenTomt, z.string().trim().min(1).optional()),
  KI_MODELL: z.preprocess(utenTomt, z.string().trim().min(1).default("claude-sonnet-5-5")),
  // Taket gjelder summen av alle KI-kall i kalendermåneden (norsk tid), regnet om fra dollar med KI_USD_NOK.
  KI_MAANEDSTAK_NOK: z.preprocess(utenTomt, z.coerce.number().min(0).max(100000).default(50)),
  KI_USD_NOK: z.preprocess(utenTomt, z.coerce.number().positive().max(1000).default(11)),
  // Et kall stoppes når månedens sum pluss reserven nærmer seg taket, så taket aldri overskrides med mer enn ett kall.
  KI_RESERVE_NOK: z.preprocess(utenTomt, z.coerce.number().min(0).max(1000).default(3)),
  KI_MAKS_PDF_MB: z.preprocess(utenTomt, z.coerce.number().positive().max(24).default(10)),
  KI_RATE_PER_TIME: z.preprocess(
    utenTomt,
    z.coerce.number().int().positive().max(1000).default(10),
  ),
  // Refusal-fallback hos Anthropic (beta). Slå av hvis API-et avviser den.
  KI_FALLBACK: z.enum(["true", "false"]).default("true"),
});

export type Config = z.infer<typeof schema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const result = schema.safeParse(env);
  if (!result.success) {
    const problems = result.error.issues
      .map((i) => `  ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Ugyldig oppsett. Sjekk .env:\n${problems}`);
  }
  return result.data;
}
