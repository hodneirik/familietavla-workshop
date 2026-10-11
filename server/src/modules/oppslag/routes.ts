import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../../core/auth.js";
import type { AppDeps } from "../../app.js";
import { LAPPFARGER, createLapp, deleteLapp, listLapper, updateLapp } from "./service.js";

const tekst = z.string().trim().min(1).max(280);
const farge = z.enum(LAPPFARGER);

/** Brukes også av KI-modulen, så forslag valideres med de samme reglene. */
export const nyLapp = z.object({ tekst, farge: farge.default("gul") });
const endring = z.object({ tekst: tekst.optional(), farge: farge.optional() });
const idParam = z.coerce.number().int().positive();

/** Alle innloggede kan lese og skrive. Endre og slette: egne lapper, eller alle som forelder. */
export function oppslagRouter({ db }: AppDeps): Router {
  const router = Router();
  router.use(requireAuth);

  router.get("/", (req, res) => {
    res.json(listLapper(db, req.user!));
  });

  router.post("/", (req, res) => {
    res.status(201).json(createLapp(db, req.user!, nyLapp.parse(req.body)));
  });

  router.patch("/:id", (req, res) => {
    res.json(updateLapp(db, req.user!, idParam.parse(req.params.id), endring.parse(req.body)));
  });

  router.delete("/:id", (req, res) => {
    deleteLapp(db, req.user!, idParam.parse(req.params.id));
    res.status(204).end();
  });

  return router;
}
