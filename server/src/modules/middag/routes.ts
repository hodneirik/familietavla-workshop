import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../../core/auth.js";
import type { AppDeps } from "../../app.js";
import { createRett, deleteRett, listRetter, updateRett } from "./retter.js";
import { giStjerner, listMiddag, settMiddag, slettMiddag } from "./service.js";

const idParam = z.coerce.number().int().positive();
const datoParam = z.string().max(10);
const tidsrom = z.object({ fra: z.string().max(10), til: z.string().max(10) });

const rett = z.object({
  tittel: z.string().trim().min(1).max(80),
  notat: z.string().trim().max(1000).nullish(),
  ingredienser: z.array(z.string().trim().max(60)).max(60).default([]),
});

/**
 * Alle innloggede kan se planen og listen med retter. Bare barna kan gi dagens middag stjerner.
 * Bare foreldre kan lage og endre retter, og velge retter for dagene. Reglene håndheves i service.ts.
 */
export function middagRouter({ db, naa = Date.now }: AppDeps): Router {
  const router = Router();
  router.use(requireAuth);

  // Rettene
  router.get("/retter", (req, res) => {
    res.json(listRetter(db, req.user!));
  });
  router.post("/retter", (req, res) => {
    res.status(201).json(createRett(db, req.user!, rett.parse(req.body)));
  });
  router.put("/retter/:id", (req, res) => {
    res.json(updateRett(db, req.user!, idParam.parse(req.params.id), rett.parse(req.body)));
  });
  router.delete("/retter/:id", (req, res) => {
    deleteRett(db, req.user!, idParam.parse(req.params.id));
    res.status(204).end();
  });

  // Planen: en rett per dag
  router.get("/", (req, res) => {
    const { fra, til } = tidsrom.parse(req.query);
    res.json(listMiddag(db, req.user!, fra, til));
  });
  router.put("/:dato", (req, res) => {
    const { rettId, ingredienser } = z
      .object({
        rettId: z.number().int().positive(),
        ingredienser: z.array(z.string().trim().max(60)).max(60).optional(),
      })
      .parse(req.body);
    res.json(settMiddag(db, req.user!, datoParam.parse(req.params.dato), rettId, ingredienser));
  });
  router.delete("/:dato", (req, res) => {
    slettMiddag(db, req.user!, datoParam.parse(req.params.dato));
    res.status(204).end();
  });
  router.put("/:dato/stjerner", (req, res) => {
    const { stjerner } = z.object({ stjerner: z.number().int().min(1).max(5) }).parse(req.body);
    res.json(giStjerner(db, req.user!, datoParam.parse(req.params.dato), stjerner, naa()));
  });

  return router;
}
