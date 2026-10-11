import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../../core/auth.js";
import type { AppDeps } from "../../app.js";
import {
  angreKjop,
  createVare,
  deleteVare,
  fjernHandlede,
  forslag,
  kjopVare,
  listVarer,
  oppdaterNotat,
} from "./service.js";

const navn = z.string().trim().min(1).max(60);
const notat = z.string().trim().max(200).nullish();
const idParam = z.coerce.number().int().positive();
const sok = z.object({ q: z.string().max(60).default("") });

/** Alle innloggede kan se lista, legge til og krysse av. Bare foreldre kan slette. */
export function handlelisteRouter({ db }: AppDeps): Router {
  const router = Router();
  router.use(requireAuth);

  router.get("/", (_req, res) => {
    res.json(listVarer(db));
  });

  router.get("/forslag", (req, res) => {
    res.json(forslag(db, sok.parse(req.query).q));
  });

  router.post("/", (req, res) => {
    const data = z.object({ navn, notat }).parse(req.body);
    const { vare, fantes } = createVare(db, req.user!, data.navn, data.notat || null);
    res.status(fantes ? 200 : 201).json({ ...vare, fantesFraFor: fantes });
  });

  router.post("/fjern-handlede", (req, res) => {
    res.json({ fjernet: fjernHandlede(db, req.user!) });
  });

  router.patch("/:id", (req, res) => {
    const data = z.object({ notat }).parse(req.body);
    res.json(oppdaterNotat(db, req.user!, idParam.parse(req.params.id), data.notat || null));
  });

  router.post("/:id/kjop", (req, res) => {
    res.json(kjopVare(db, req.user!, idParam.parse(req.params.id)));
  });

  router.post("/:id/angre", (req, res) => {
    res.json(angreKjop(db, req.user!, idParam.parse(req.params.id)));
  });

  router.delete("/:id", (req, res) => {
    deleteVare(db, req.user!, idParam.parse(req.params.id));
    res.status(204).end();
  });

  return router;
}
