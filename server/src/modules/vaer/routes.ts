import { Router } from "express";
import { requireAuth } from "../../core/auth.js";
import type { AppDeps } from "../../app.js";
import { lagVaerTjeneste } from "./service.js";

/** Værvarsel for de neste sju dagene. Krever innlogging som alt annet i appen. */
export function vaerRouter({ config, log, fetch, naa }: AppDeps): Router {
  const router = Router();
  router.use(requireAuth);
  const hentVarsel = lagVaerTjeneste({ config, log, fetch, naa });

  router.get("/", async (_req, res) => {
    res.json(await hentVarsel());
  });

  return router;
}
