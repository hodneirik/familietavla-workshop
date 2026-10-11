import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../../core/auth.js";
import type { AppDeps } from "../../app.js";
import {
  createHendelse,
  createKalender,
  deleteHendelse,
  deleteKalender,
  listHendelser,
  listKalendere,
  updateHendelse,
  updateKalender,
} from "./service.js";

const navn = z.string().trim().min(1).max(40);
const farge = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const idParam = z.coerce.number().int().positive();

const nyKalender = z.object({ navn, farge: farge.default("#4f8cff") });
const endreKalender = z.object({ navn: navn.optional(), farge: farge.optional() });

/** Brukes også av KI-modulen, så forslag valideres med de samme reglene. */
export const hendelse = z.object({
  kalenderId: z.number().int().positive(),
  tittel: z.string().trim().min(1).max(80),
  sted: z.string().trim().max(80).nullish(),
  helDag: z.boolean().default(false),
  start: z.string().max(16),
  slutt: z.string().max(16).nullish(),
  gjentas: z.literal("ukentlig").nullish(),
  gjentasTil: z.string().max(10).nullish(),
});
const tidsrom = z.object({ fra: z.string().max(10), til: z.string().max(10) });

/**
 * Alle innloggede kan se kalenderne og avtalene. Foreløpig er det bare voksne som kan legge inn,
 * endre og slette. Reglene håndheves i service.ts.
 */
export function kalenderRouter({ db }: AppDeps): Router {
  const router = Router();
  router.use(requireAuth);

  router.get("/kalendere", (_req, res) => {
    res.json(listKalendere(db));
  });
  router.post("/kalendere", (req, res) => {
    res.status(201).json(createKalender(db, req.user!, nyKalender.parse(req.body)));
  });
  router.patch("/kalendere/:id", (req, res) => {
    res.json(
      updateKalender(db, req.user!, idParam.parse(req.params.id), endreKalender.parse(req.body)),
    );
  });
  router.delete("/kalendere/:id", (req, res) => {
    deleteKalender(db, req.user!, idParam.parse(req.params.id));
    res.status(204).end();
  });

  router.get("/hendelser", (req, res) => {
    const { fra, til } = tidsrom.parse(req.query);
    res.json(listHendelser(db, fra, til));
  });
  router.post("/hendelser", (req, res) => {
    res.status(201).json(createHendelse(db, req.user!, hendelse.parse(req.body)));
  });
  router.put("/hendelser/:id", (req, res) => {
    res.json(updateHendelse(db, req.user!, idParam.parse(req.params.id), hendelse.parse(req.body)));
  });
  router.delete("/hendelser/:id", (req, res) => {
    deleteHendelse(db, req.user!, idParam.parse(req.params.id));
    res.status(204).end();
  });

  return router;
}
