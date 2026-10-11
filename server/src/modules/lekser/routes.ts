import { Router } from "express";
import { z } from "zod";
import type { AppDeps } from "../../app.js";
import { requireAuth } from "../../core/auth.js";
import { createLekser, deleteLekse, listLekser, settGjort, updateLekse } from "./service.js";

const tittel = z.string().trim().min(1).max(120);
const fag = z.string().trim().max(40).nullish();
const fritekst = z.string().max(1000).nullish();
const frist = z.string().max(10);

/** Brukes også av KI-modulen, så forslag valideres med de samme reglene. */
export const nyLekse = z.object({
  barnIder: z.array(z.number().int().positive()).min(1).max(10),
  tittel,
  fag,
  fritekst,
  frist,
});
const endring = z.object({
  tittel: tittel.optional(),
  fag,
  fritekst,
  frist: frist.optional(),
});
const idParam = z.coerce.number().int().positive();

/**
 * Barn ser og krysser av sine egne lekser. Foreldre legger inn, endrer og sletter, ser alle barnas
 * lekser og kan krysse av for dem. Reglene håndheves i service.ts.
 */
export function lekserRouter({ db, naa = Date.now }: AppDeps): Router {
  const router = Router();
  router.use(requireAuth);

  router.get("/", (req, res) => {
    res.json(listLekser(db, req.user!, naa()));
  });
  router.post("/", (req, res) => {
    res.status(201).json(createLekser(db, req.user!, nyLekse.parse(req.body)));
  });
  router.patch("/:id", (req, res) => {
    res.json(updateLekse(db, req.user!, idParam.parse(req.params.id), endring.parse(req.body)));
  });
  router.delete("/:id", (req, res) => {
    deleteLekse(db, req.user!, idParam.parse(req.params.id));
    res.status(204).end();
  });
  router.post("/:id/gjort", (req, res) => {
    res.json(settGjort(db, req.user!, idParam.parse(req.params.id), true));
  });
  router.post("/:id/ugjort", (req, res) => {
    res.json(settGjort(db, req.user!, idParam.parse(req.params.id), false));
  });

  return router;
}
