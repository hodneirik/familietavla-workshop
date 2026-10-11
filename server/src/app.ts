import { existsSync } from "node:fs";
import path from "node:path";
import cookieParser from "cookie-parser";
import express, { type Express } from "express";
import { rateLimit } from "express-rate-limit";
import helmet from "helmet";
import { begrensBesteforeldre, loadUser } from "./core/auth.js";
import { authRouter } from "./modules/auth/routes.js";
import { gjoremalRouter } from "./modules/gjoremal/routes.js";
import { handlelisteRouter } from "./modules/handleliste/routes.js";
import { kalenderRouter } from "./modules/kalender/routes.js";
import { kiRouter } from "./modules/ki/routes.js";
import { lagAnthropicKlient, type KiKlient } from "./modules/ki/klient.js";
import { lekserRouter } from "./modules/lekser/routes.js";
import { paaminnelserRouter } from "./modules/paaminnelser/routes.js";
import { middagRouter } from "./modules/middag/routes.js";
import { oppslagRouter } from "./modules/oppslag/routes.js";
import { usersRouter } from "./modules/users/routes.js";
import { vaerRouter } from "./modules/vaer/routes.js";
import type { Config } from "./config.js";
import { errorHandler, notFound } from "./core/errors.js";
import type { Logger } from "./core/logger.js";
import type { Db } from "./db/client.js";

export interface AppDeps {
  config: Config;
  db: Db;
  log: Logger;
  /** Kan byttes ut i tester, så ingenting går mot nettet. */
  fetch?: typeof fetch;
  naa?: () => number;
  /** KI-klienten kan byttes ut i tester. Uten den lages den fra ANTHROPIC_API_KEY, hvis nøkkelen finnes. */
  kiKlient?: KiKlient | null;
}

export function createApp({
  config,
  db,
  log,
  fetch: fetchFn,
  naa,
  kiKlient: kiKlientInnsatt,
}: AppDeps): Express {
  const app = express();
  const klokke = naa ?? Date.now;
  const kiKlient =
    kiKlientInnsatt !== undefined
      ? kiKlientInnsatt
      : config.KI_AKTIV === "true" && config.ANTHROPIC_API_KEY
        ? lagAnthropicKlient({
            apiKey: config.ANTHROPIC_API_KEY,
            fetch: fetchFn,
            timeoutMs: 150_000,
            log,
          })
        : null;
  app.disable("x-powered-by");
  app.set("trust proxy", config.TRUST_PROXY);

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", "data:"],
          connectSrc: ["'self'"],
          objectSrc: ["'none'"],
          frameAncestors: ["'none'"],
          // http under lokal testing: ikke tving oppgradering til https
          upgradeInsecureRequests: config.COOKIE_SECURE === "true" ? [] : null,
        },
      },
      hsts: config.COOKIE_SECURE === "true",
    }),
  );
  // Den store grensen for PDF-opplasting gjelder bare KI-ruten, og settes der etter innlogging
  const vanligJson = express.json({ limit: "100kb" });
  app.use((req, res, next) =>
    req.path === "/api/ki/ukeplan/analyser" ? next() : vanligJson(req, res, next),
  );
  app.use(cookieParser(config.SESSION_SECRET));

  // Origin-kontroll mot forfalskede forespørsler på alle endrende kall
  app.use("/api", (req, res, next) => {
    if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
    const origin = req.get("origin");
    if (origin) {
      let tillatt = false;
      try {
        tillatt = new URL(origin).host === req.get("host");
      } catch {
        // Ugyldig eller «null»-opprinnelse avvises
      }
      if (!tillatt) {
        res.status(403).json({ feil: "Ugyldig opprinnelse" });
        return;
      }
    }
    next();
  });

  app.use(
    "/api",
    rateLimit({ windowMs: 60_000, limit: 300, standardHeaders: "draft-7", legacyHeaders: false }),
  );

  app.get("/api/health", (_req, res) => {
    db.prepare("SELECT 1").get();
    res.json({ status: "ok" });
  });

  const deps = { config, db, log };
  app.use("/api", loadUser(db));
  app.use("/api", begrensBesteforeldre);
  app.use("/api/auth", authRouter(deps));
  app.use("/api/users", usersRouter(deps));
  app.use("/api/oppslag", oppslagRouter(deps));
  app.use("/api/gjoremal", gjoremalRouter({ ...deps, naa }));
  app.use("/api/kalender", kalenderRouter(deps));
  app.use("/api/lekser", lekserRouter({ ...deps, naa }));
  app.use("/api/paaminnelser", paaminnelserRouter({ ...deps, naa }));
  app.use("/api/ki", kiRouter({ config, db, log, naa: klokke, klient: kiKlient }));
  app.use("/api/handleliste", handlelisteRouter(deps));
  app.use("/api/middag", middagRouter({ ...deps, naa }));
  if (config.VAER_AKTIV === "true")
    app.use("/api/vaer", vaerRouter({ ...deps, fetch: fetchFn, naa }));

  app.use("/api", notFound);

  const webDir = config.WEB_DIR ?? path.resolve(process.cwd(), "web/dist");
  if (existsSync(webDir)) {
    // Filene i /assets har nye navn for hver bygging og kan hurtiglagres lenge. Selve siden (index.html)
    // må alltid sjekkes på nytt, så en app på hjemskjermen finner ut at det har kommet en ny versjon.
    app.use(
      express.static(webDir, {
        setHeaders: (res, fil) => {
          if (fil.includes(`${path.sep}assets${path.sep}`)) {
            res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
          } else if (fil.endsWith(".html")) {
            res.setHeader("Cache-Control", "no-cache");
          }
        },
      }),
    );
    app.get("/{*splat}", (_req, res) => {
      res.setHeader("Cache-Control", "no-cache");
      res.sendFile(path.join(webDir, "index.html"));
    });
  }

  app.use(errorHandler(log));
  return app;
}
