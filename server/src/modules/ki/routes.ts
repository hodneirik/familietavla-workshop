import express, { Router } from "express";
import { rateLimit } from "express-rate-limit";
import { z } from "zod";
import { requireAuth, requireRolle } from "../../core/auth.js";
import { HttpError } from "../../core/errors.js";
import { lagJobbregister } from "./jobber.js";
import {
  ForeslaRetter,
  LeggInnRetter,
  kjorRetterForslag,
  leggInnRetter,
  type RetterResultat,
} from "./retter.js";
import {
  ForeslaMiddag,
  LeggInnMiddag,
  kjorMiddagForslag,
  leggInnMiddag,
  ledigeDager,
  type MiddagResultat,
} from "./middag.js";
import {
  Analyser,
  Innstillinger,
  LeggInn,
  finnDuplikat,
  forberedAnalyse,
  hentInnstillinger,
  jobbFeilmelding,
  kjorAnalyse,
  krevAktiv,
  krevUnderTak,
  lagreInnstillinger,
  leggInn,
  status,
  type AnalyseResultat,
  type KiDeps,
} from "./service.js";

/**
 * KI er bare for foreldre, på alle metoder. `begrensBesteforeldre` slipper GET gjennom, så rollen sjekkes her.
 * Analysen kjører som en jobb i bakgrunnen, siden den kan ta mer enn et minutt.
 */
export function kiRouter(deps: KiDeps): Router {
  const router = Router();
  const jobber = lagJobbregister<AnalyseResultat | MiddagResultat | RetterResultat>(deps.naa);
  router.use(requireAuth, requireRolle("forelder"));

  router.get("/status", (_req, res) => {
    res.json(status(deps));
  });

  router.get("/innstillinger", (_req, res) => {
    res.json(hentInnstillinger(deps.db));
  });
  router.put("/innstillinger", (req, res) => {
    res.json(lagreInnstillinger(deps.db, req.user!, Innstillinger.parse(req.body)));
  });

  // PDF-en kommer som base64 i JSON. Den store grensen gjelder bare denne ruten, og først etter innlogging.
  const pdfGrense = `${Math.ceil(deps.config.KI_MAKS_PDF_MB * 1.4) + 1}mb`;
  const perTime = rateLimit({
    windowMs: 3_600_000,
    limit: deps.config.KI_RATE_PER_TIME,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    keyGenerator: (req) => `ki-${req.user?.id ?? "ukjent"}`,
    handler: (_req, res) => {
      res.status(429).json({ feil: "For mange analyser den siste timen. Prøv igjen senere." });
    },
    validate: { keyGeneratorIpFallback: false },
  });

  router.post("/ukeplan/analyser", express.json({ limit: pdfGrense }), perTime, (req, res) => {
    krevAktiv(deps);
    const data = Analyser.parse(req.body);
    const kontrollsum = forberedAnalyse(deps, data);
    const duplikat = finnDuplikat(deps.db, kontrollsum);
    if (duplikat && !data.bekreftDuplikat) {
      res.json({ duplikat, kontrollsum });
      return;
    }
    krevUnderTak(deps.db, deps.config, deps.naa());
    const bruker = req.user!;
    const jobbId = jobber.start(
      bruker.id,
      () => kjorAnalyse(deps, bruker, data, kontrollsum),
      (err) => jobbFeilmelding(deps, err),
    );
    res.status(202).json({ jobbId });
  });

  router.post("/middag/foresla", perTime, (req, res) => {
    krevAktiv(deps);
    const data = ForeslaMiddag.parse(req.body);
    ledigeDager(deps, data);
    krevUnderTak(deps.db, deps.config, deps.naa());
    const bruker = req.user!;
    const jobbId = jobber.start(
      bruker.id,
      () => kjorMiddagForslag(deps, bruker, data),
      (err) => jobbFeilmelding(deps, err),
    );
    res.status(202).json({ jobbId });
  });

  router.post("/middag/legg-inn", (req, res) => {
    krevAktiv(deps);
    res.json(leggInnMiddag(deps, req.user!, LeggInnMiddag.parse(req.body)));
  });

  router.post("/retter/foresla", perTime, (req, res) => {
    krevAktiv(deps);
    const data = ForeslaRetter.parse(req.body);
    krevUnderTak(deps.db, deps.config, deps.naa());
    const bruker = req.user!;
    const jobbId = jobber.start(
      bruker.id,
      () => kjorRetterForslag(deps, bruker, data),
      (err) => jobbFeilmelding(deps, err),
    );
    res.status(202).json({ jobbId });
  });

  router.post("/retter/legg-inn", (req, res) => {
    krevAktiv(deps);
    res.json(leggInnRetter(deps, req.user!, LeggInnRetter.parse(req.body)));
  });

  router.get("/jobber/:id", (req, res) => {
    const id = z.string().max(60).parse(req.params.id);
    res.json(jobber.hent(id, req.user!.id));
  });

  router.post("/ukeplan/legg-inn", (req, res) => {
    krevAktiv(deps);
    if (!req.body) throw new HttpError(400, "Mangler innhold");
    res.json(leggInn(deps, req.user!, LeggInn.parse(req.body)));
  });

  return router;
}
